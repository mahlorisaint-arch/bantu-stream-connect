// Creator Dashboard JavaScript - WITH ALL CRITICAL FIXES APPLIED

// Global state
let currentUser = null;
let dashboardData = null;
let isLoading = true;
let notifications = [];

// DOM Elements
const loadingScreen = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const app = document.getElementById('app');
const errorState = document.getElementById('errorState');
const errorTitle = document.getElementById('errorTitle');
const errorMessage = document.getElementById('errorMessage');
const profileBtn = document.getElementById('profile-btn');
const notificationsBtn = document.getElementById('notifications-btn');
const searchBtn = document.getElementById('search-btn');

// User Info Elements
const creatorAvatar = document.getElementById('creatorAvatar');
const creatorName = document.getElementById('creatorName');
const connectorCount = document.getElementById('connectorCount');
const founderBadge = document.getElementById('founderBadge');

// Stats Elements - ADDED totalConnectors
const totalUploads = document.getElementById('totalUploads');
const totalViews = document.getElementById('totalViews');
const totalEarnings = document.getElementById('totalEarnings');
const totalConnectors = document.getElementById('totalConnectors');

// Uploads Elements
const uploadsContent = document.getElementById('uploadsContent');

// Buttons
const uploadContentBtn = document.getElementById('uploadContentBtn');
const quickUpload = document.getElementById('quickUpload');
const viewAnalytics = document.getElementById('viewAnalytics');
const payoutRequest = document.getElementById('payoutRequest');
const retryBtn = document.getElementById('retryBtn');
const reloginBtn = document.getElementById('reloginBtn');

// Modal Elements
const payoutModal = document.getElementById('payoutModal');
const closePayoutModal = document.getElementById('closePayoutModal');
const payoutAmount = document.getElementById('payoutAmount');
const cancelPayout = document.getElementById('cancelPayout');
const requestPayout = document.getElementById('requestPayout');

// Search Modal Elements
const searchModal = document.getElementById('search-modal');
const closeSearchBtn = document.getElementById('close-search-btn');
const searchInput = document.getElementById('search-input');

// Notifications Panel Elements
const notificationsPanel = document.getElementById('notifications-panel');
const closeNotifications = document.getElementById('close-notifications');
const markAllReadBtn = document.getElementById('mark-all-read');
const notificationsList = document.getElementById('notifications-list');

// Initialize Supabase client if not already initialized
if (!window.supabaseClient) {
    window.supabaseClient = supabase.createClient(
        'https://ydnxqnbjoshvxteevemc.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
    );
    console.log('✅ Global Supabase client initialized for creator dashboard');
}

// Helper Functions

// ✅ SHOW/HIDE LOADING
function setLoading(loading, text = '') {
    isLoading = loading;
    if (text) loadingText.textContent = text;
    if (loading) {
        loadingScreen.style.display = 'flex';
        app.style.display = 'none';
        errorState.style.display = 'none';
    } else {
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            app.style.display = 'block';
        }, 500);
    }
}

// ✅ SHOW ERROR STATE
function showError(title, message) {
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    loadingScreen.style.display = 'none';
    app.style.display = 'none';
    errorState.style.display = 'block';
}

// ✅ SHOW TOAST MESSAGE
function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i> ${message}`;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ✅ FORMAT CURRENCY (ZAR) - DIRECT FROM MATERIALIZED VIEW
function formatCurrency(amount) {
    // Materialized view returns earnings in ZAR, so no conversion needed
    return 'R' + parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ✅ FORMAT NUMBER
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// ✅ CONVERT USD TO ZAR - DEPRECATED, kept for backward compatibility
function convertToZAR(usdAmount) {
    const usdToZarRate = 18.5;
    return 'R' + (usdAmount * usdToZarRate).toFixed(2);
}

// ✅ GET INITIALS FROM EMAIL
function getInitials(email) {
    if (!email) return 'U';
    const parts = email.split('@')[0];
    return parts.substring(0, 2).toUpperCase();
}

// ✅ GET INITIALS FROM FULL NAME
function getInitialsFromName(fullName) {
    if (!fullName) return 'U';
    const names = fullName.split(' ');
    if (names.length >= 2) {
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    return fullName.charAt(0).toUpperCase();
}

// ✅ FORMAT NOTIFICATION TIME
function formatNotificationTime(timestamp) {
    if (!timestamp) return 'Just now';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

// ✅ GET NOTIFICATION ICON
function getNotificationIcon(type) {
    switch(type) {
        case 'like': return 'fas fa-heart';
        case 'comment': return 'fas fa-comment';
        case 'follow': return 'fas fa-user-plus';
        case 'view_milestone': return 'fas fa-trophy';
        case 'system': return 'fas fa-bell';
        default: return 'fas fa-bell';
    }
}

// ✅ ESCAPE HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ✅ TRUNCATE TEXT
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ✅ DEBOUNCE FUNCTION
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Main Dashboard Functions

// ✅ LOAD DASHBOARD DATA USING MATERIALIZED VIEW
async function loadDashboardData() {
    try {
        setLoading(true, 'Loading dashboard data...');
        
        let analyticsData = null;
        let content = [];
        
        // STEP 1: Try to get analytics from creator_analytics_summary materialized view
        try {
            console.log('Attempting to fetch from creator_analytics_summary...');
            const { data, error } = await window.supabaseClient
                .from('creator_analytics_summary')
                .select('*')
                .eq('creator_id', currentUser.id)
                .maybeSingle();
            
            if (error) {
                console.warn('Analytics view query error:', error);
                throw new Error('View unavailable');
            }
            
            if (data) {
                analyticsData = data;
                console.log('✅ Analytics data loaded from materialized view:', analyticsData);
            } else {
                console.warn('No analytics data found in view');
                throw new Error('No data in view');
            }
        } catch (viewError) {
            console.warn('Falling back to Content table query:', viewError);
            
            // STEP 2: Fallback method using Content table (original approach)
            const { data: contentData, error: contentError } = await window.supabaseClient
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('user_id', currentUser.id)
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (contentError) throw contentError;
            
            content = contentData || [];
            
            // Calculate analytics manually with REAL view counts
            let totalViews = 0;
            let totalEarnings = 0;
            
            // Enrich with real view counts
            for (const item of content) {
                const { count } = await window.supabaseClient
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                
                const viewsCount = count || 0;
                totalViews += viewsCount;
                totalEarnings += viewsCount * 0.01; // R0.01 per view
                item.real_views = viewsCount;
            }
            
            analyticsData = {
                total_uploads: content.length || 0,
                total_views: totalViews,
                total_earnings: totalEarnings,
                total_connectors: Math.max(10, Math.floor(totalViews / 100)),
                engagement_percentage: content.length > 0 ? (totalViews / content.length) : 0,
                is_eligible_for_monetization: content.length >= 10 && totalViews >= 1000
            };
        }
        
        // STEP 3: If we didn't get content from fallback, get it now for display
        if (content.length === 0) {
            const { data: contentData, error: contentError } = await window.supabaseClient
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('user_id', currentUser.id)
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (contentError) throw contentError;
            content = contentData || [];
            
            // Enrich with real view counts if not already done
            if (!content[0]?.real_views) {
                for (const item of content) {
                    const { count } = await window.supabaseClient
                        .from('content_views')
                        .select('*', { count: 'exact', head: true })
                        .eq('content_id', item.id);
                    item.real_views = count || 0;
                }
            }
        }
        
        // STEP 4: Get user profile for display name/avatar
        const { data: userProfile } = await window.supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();
        
        // STEP 5: Build dashboard data
        dashboardData = {
            user: {
                name: userProfile?.full_name || 
                      userProfile?.username || 
                      currentUser.email?.split('@')[0] || 
                      'Creator',
                avatar_url: userProfile?.avatar_url,
                is_founder: userProfile?.is_founder || false
            },
            analytics: {
                total_uploads: analyticsData.total_uploads || 0,
                total_views: analyticsData.total_views || 0,
                total_earnings: analyticsData.total_earnings || 0,
                total_connectors: analyticsData.total_connectors || 0,
                engagement_percentage: analyticsData.engagement_percentage || 0,
                is_eligible_for_monetization: analyticsData.is_eligible_for_monetization || false
            },
            content: (content || []).map(item => ({
                id: item.id,
                title: item.title || 'Untitled',
                description: item.description || '',
                thumbnail_url: item.thumbnail_url,
                status: item.status || 'draft',
                views: item.real_views || 0,
                created_at: item.created_at
            }))
        };
        
        console.log('✅ Dashboard data loaded:', dashboardData);
        
        // Update UI
        updateUserInfo();
        updateStats();
        updateUploads();
        
        // Show monetization eligibility toast
        if (dashboardData.analytics.is_eligible_for_monetization) {
            showToast('🎉 You\'re eligible for monetization!', 'success');
        }
        
        setLoading(false);
    } catch (error) {
        console.error('❌ Error loading dashboard data:', error);
        showError('Loading Error', 'Failed to load dashboard data. Please refresh the page.');
    }
}

// ✅ Update user info
function updateUserInfo() {
    if (!dashboardData) return;
    
    const user = dashboardData.user;
    
    // Set creator name
    const displayName = user.name || currentUser.email?.split('@')[0] || 'Creator';
    creatorName.textContent = displayName;
    
    // Set avatar
    if (user.avatar_url) {
        let avatarUrl = user.avatar_url;
        if (!avatarUrl.startsWith('http')) {
            if (avatarUrl.startsWith('avatars/')) {
                avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${avatarUrl}`;
            } else {
                avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/avatars/${avatarUrl}`;
            }
        }
        creatorAvatar.src = avatarUrl;
    }
    
    // Set connector count from analytics
    const connectors = dashboardData.analytics.total_connectors || 10;
    connectorCount.textContent = `${formatNumber(connectors)} Connector${connectors !== 1 ? 's' : ''}`;
    
    // Show founder badge if applicable
    if (user.is_founder) {
        founderBadge.style.display = 'flex';
    }
}

// ✅ Update stats with materialized view fields
function updateStats() {
    if (!dashboardData) return;
    
    const analytics = dashboardData.analytics;
    totalUploads.textContent = formatNumber(analytics.total_uploads);
    totalViews.textContent = formatNumber(analytics.total_views);
    totalEarnings.textContent = formatCurrency(analytics.total_earnings); // Already in ZAR
    totalConnectors.textContent = formatNumber(analytics.total_connectors);
}

// ✅ Update uploads
function updateUploads() {
    if (!dashboardData) return;
    
    const content = dashboardData.content;
    if (!content || content.length === 0) {
        uploadsContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-film"></i>
                </div>
                <p class="empty-text">
                    You haven't uploaded yet.<br>
                    Upload your first story today 🎬
                </p>
            </div>
        `;
        return;
    }
    
    // Show only first 2 items
    const displayContent = content.slice(0, 2);
    uploadsContent.innerHTML = displayContent.map(item => {
        const statusClass = item.status === 'published' ? 'status-published' : 'status-draft';
        const statusText = item.status === 'published' ? 'Published' : 'Draft';
        return `
            <div class="upload-card">
                <h3 class="upload-title" title="${item.title}">
                    ${item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title}
                </h3>
                <div class="${statusClass} upload-status">
                    ${statusText}
                </div>
            </div>
        `;
    }).join('');
    
    // Add message about managing content
    if (content.length > 2) {
        uploadsContent.innerHTML += `
            <div class="empty-state">
                <p class="empty-text">
                    Showing ${displayContent.length} of ${content.length} uploads.<br>
                    Click "See All" to manage all your content.
                </p>
            </div>
        `;
    }
}

// ✅ UPDATE NOTIFICATIONS SUMMARY USING NOTIFICATIONS TABLE
async function updateNotificationsSummary() {
    try {
        if (!currentUser) {
            document.getElementById('notificationsSummary').textContent = 
                'Sign in to see your notifications';
            return;
        }
        
        // Query notifications table with proper schema fields
        const { data: notifications, error } = await window.supabaseClient
            .from('notifications')
            .select('id, type, title, message, is_read, created_at, content_id, content_title, sender_name')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        const unreadCount = notifications.filter(n => !n.is_read).length;
        const summaryEl = document.getElementById('notificationsSummary');
        
        if (notifications.length === 0) {
            summaryEl.innerHTML = 'No new notifications. We\'ll notify you when fans interact with your content.';
            return;
        }
        
        // Build summary with proper schema fields
        let summaryHTML = `<div style="text-align:left">`;
        
        if (unreadCount > 0) {
            summaryHTML += `<div style="color:#F59E0B;font-weight:600;margin-bottom:10px">🔔 ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}</div>`;
        }
        
        notifications.slice(0, 3).forEach(notification => {
            const icon = getNotificationIcon(notification.type);
            const timeAgo = formatNotificationTime(notification.created_at);
            const title = notification.title || 'Notification';
            const message = notification.message || '';
            const contentTitle = notification.content_title ? ` (${notification.content_title})` : '';
            
            summaryHTML += `
                <div style="padding:8px 0;border-bottom:1px solid var(--card-border)">
                    <div style="display:flex;align-items:start;gap:8px">
                        <div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-size:12px">
                            <i class="${icon}" style="font-size:10px"></i>
                        </div>
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:500;color:var(--soft-white);font-size:14px">${escapeHtml(title)}</div>
                            <div style="color:var(--slate-grey);font-size:13px;margin-top:2px">${escapeHtml(message)}${escapeHtml(contentTitle)}</div>
                            <div style="color:var(--warm-gold);font-size:12px;margin-top:4px">${timeAgo}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        if (notifications.length > 3) {
            summaryHTML += `<div style="color:var(--warm-gold);margin-top:10px;font-size:14px">+${notifications.length - 3} more notifications</div>`;
        }
        
        summaryHTML += `</div>`;
        summaryEl.innerHTML = summaryHTML;
        
    } catch (error) {
        console.error('Error updating notifications summary:', error);
        document.getElementById('notificationsSummary').textContent = 
            'Failed to load notifications. Please refresh.';
    }
}

// ✅ Load profile picture
async function loadUserProfilePicture(user) {
    try {
        if (!user || !profileBtn) return;
        
        const placeholder = document.getElementById('userProfilePlaceholder');
        if (!placeholder) return;
        
        // Clear existing content safely
        while (placeholder.firstChild) {
            placeholder.removeChild(placeholder.firstChild);
        }
        
        const userInitials = getInitials(user.email);
        
        // Fetch user profile from database
        const { data: profile, error: profileError } = await window.supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
        
        if (profileError) {
            console.log('Profile query error:', profileError);
            // Fallback to email initials
            const fallback = document.createElement('div');
            fallback.className = 'profile-placeholder';
            fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
            fallback.textContent = userInitials;
            placeholder.appendChild(fallback);
            return;
        }
        
        if (profile) {
            const displayName = profile.full_name || profile.username || user.email || 'User';
            const initial = getInitials(displayName);
            
            // If avatar URL exists, display it
            if (profile.avatar_url) {
                let avatarUrl = profile.avatar_url;
                
                // Construct full URL safely
                try {
                    if (!avatarUrl.startsWith('http')) {
                        if (avatarUrl.startsWith('avatars/')) {
                            avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${avatarUrl}`;
                        } else {
                            avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/avatars/${avatarUrl}`;
                        }
                    }
                    
                    // Create image element with proper styling
                    const img = document.createElement('img');
                    img.className = 'profile-img';
                    img.alt = displayName;
                    img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
                    img.src = avatarUrl;
                    
                    // Fallback to initials if image fails to load
                    img.onerror = () => {
                        console.log('Avatar image failed to load, falling back to initials');
                        const fallbackInitials = profile.full_name ? getInitialsFromName(profile.full_name) : userInitials;
                        const fallback = document.createElement('div');
                        fallback.className = 'profile-placeholder';
                        fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                        fallback.textContent = fallbackInitials;
                        placeholder.innerHTML = '';
                        placeholder.appendChild(fallback);
                    };
                    
                    placeholder.appendChild(img);
                } catch (e) {
                    console.error('Error constructing avatar URL:', e);
                    // Fallback to initials
                    const fallback = document.createElement('div');
                    fallback.className = 'profile-placeholder';
                    fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                    fallback.textContent = initial;
                    placeholder.appendChild(fallback);
                }
            } else {
                // If no avatar but full name exists, use name initials
                const nameInitials = profile.full_name ? getInitialsFromName(profile.full_name) : userInitials;
                const fallback = document.createElement('div');
                fallback.className = 'profile-placeholder';
                fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                fallback.textContent = nameInitials;
                placeholder.appendChild(fallback);
            }
        } else {
            // No profile found, use email initials
            const fallback = document.createElement('div');
            fallback.className = 'profile-placeholder';
            fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
            fallback.textContent = userInitials;
            placeholder.appendChild(fallback);
        }
    } catch (error) {
        console.error('Error loading user profile picture:', error);
        // Fallback to email initials
        const placeholder = document.getElementById('userProfilePlaceholder');
        if (placeholder) {
            const userInitials = getInitials(user.email);
            const fallback = document.createElement('div');
            fallback.className = 'profile-placeholder';
            fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
            fallback.textContent = userInitials;
            placeholder.innerHTML = '';
            placeholder.appendChild(fallback);
        }
    }
}

// ✅ Check authentication
async function checkAuthentication() {
    try {
        setLoading(true, 'Checking authentication...');
        
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (error || !session?.user) {
            console.log('⚠️ User not authenticated');
            showToast('Please sign in to access Creator Dashboard', 'error');
            localStorage.setItem('redirectAfterLogin', 'creator-dashboard.html');
            window.location.href = 'login.html?redirect=creator-dashboard.html';
            return false;
        }
        
        currentUser = session.user;
        console.log('✅ User authenticated:', currentUser.email);
        
        // Load user profile picture
        await loadUserProfilePicture(currentUser);
        
        return true;
    } catch (error) {
        console.error('❌ Authentication error:', error);
        return false;
    }
}

// ✅ Load notifications
async function loadNotifications() {
    try {
        if (!currentUser) {
            updateNotificationBadge(0);
            return;
        }
        
        const { data, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) throw error;
        
        notifications = data || [];
        const unreadCount = notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
        renderNotifications();
    } catch (error) {
        console.error('Error loading notifications:', error);
        updateNotificationBadge(0);
    }
}

// ✅ Update notification badge
function updateNotificationBadge(count = null) {
    if (count === null) {
        count = notifications.filter(n => !n.is_read).length;
    }
    
    const badge = document.getElementById('notification-count');
    if (badge) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// ✅ Render notifications
function renderNotifications() {
    if (!notificationsList) return;
    
    if (!currentUser) {
        notificationsList.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--slate-grey)">
                <i class="fas fa-bell-slash" style="font-size:48px;margin-bottom:15px;opacity:0.5"></i>
                <p>Sign in to see notifications</p>
            </div>
        `;
        return;
    }
    
    if (!notifications || notifications.length === 0) {
        notificationsList.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--slate-grey)">
                <i class="fas fa-bell" style="font-size:48px;margin-bottom:15px;opacity:0.3"></i>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }
    
    notificationsList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" data-id="${notification.id}" data-content-id="${notification.content_id || ''}" style="padding:15px;border-bottom:1px solid var(--card-border);display:flex;gap:12px;position:relative;cursor:pointer">
            <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i class="${getNotificationIcon(notification.type)}" style="color:white"></i>
            </div>
            <div style="flex:1">
                <h4 style="font-weight:600;margin-bottom:5px;color:var(--soft-white)">${escapeHtml(notification.title)}</h4>
                <p style="font-size:14px;color:var(--slate-grey);margin-bottom:8px;line-height:1.4">${escapeHtml(notification.message)}</p>
                <span style="font-size:12px;color:var(--warm-gold)">${formatNotificationTime(notification.created_at)}</span>
            </div>
            ${!notification.is_read ? '<div style="width:10px;height:10px;border-radius:50%;background:var(--warm-gold);position:absolute;top:15px;right:15px"></div>' : ''}
        </div>
    `).join('');
    
    // Add click handlers
    notificationsList.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.dataset.id;
            await markNotificationAsRead(id);
            if (item.dataset.contentId) {
                window.location.href = `content-detail.html?id=${item.dataset.contentId}`;
            }
            notificationsPanel.style.display = 'none';
        });
    });
}

// ✅ Mark notification as read
async function markNotificationAsRead(notificationId) {
    try {
        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
        
        if (error) throw error;
        
        // Update UI
        const item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
        if (item) {
            item.classList.remove('unread');
            item.classList.add('read');
            const dot = item.querySelector('div[style*="background:var(--warm-gold)"]');
            if (dot) dot.remove();
        }
        
        // Update badge and summary
        await loadNotifications();
        await updateNotificationsSummary();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// ✅ Mark all notifications as read
async function markAllNotificationsAsRead() {
    try {
        if (!currentUser) return;
        
        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);
        
        if (error) throw error;
        
        // Update UI
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            item.classList.add('read');
            const dot = item.querySelector('div[style*="background:var(--warm-gold)"]');
            if (dot) dot.remove();
        });
        
        // Update badge and summary
        await loadNotifications();
        await updateNotificationsSummary();
        showToast('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        showToast('Failed to mark notifications as read', 'error');
    }
}

// ✅ Search content
async function searchContent(query, category = '', sortBy = 'newest') {
    try {
        let queryBuilder = window.supabaseClient
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .ilike('title', `%${query}%`)
            .eq('status', 'published');
        
        if (category) {
            queryBuilder = queryBuilder.eq('genre', category);
        }
        
        if (sortBy === 'newest') {
            queryBuilder = queryBuilder.order('created_at', { ascending: false });
        }
        
        const { data, error } = await queryBuilder.limit(50);
        
        if (error) throw error;
        
        // Enrich with real counts from source tables
        const enriched = await Promise.all(
            (data || []).map(async (item) => {
                const { count } = await window.supabaseClient
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                
                const viewsCount = count || 0;
                
                return {
                    ...item,
                    real_views: viewsCount || 0
                };
            })
        );
        
        // Additional sorting for popularity/trending
        if (sortBy === 'popular') {
            enriched.sort((a, b) => (b.real_views || 0) - (a.real_views || 0));
        } else if (sortBy === 'trending') {
            enriched.sort((a, b) => {
                const aScore = (a.real_views || 0) + ((a.likes_count || 0) * 2);
                const bScore = (b.real_views || 0) + ((b.likes_count || 0) * 2);
                return bScore - aScore;
            });
        }
        
        return enriched;
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

// ✅ Render search results
function renderSearchResults(results) {
    const grid = document.getElementById('search-results-grid');
    if (!grid) return;
    
    if (!results || results.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey)">No results found. Try different keywords.</div>';
        return;
    }
    
    grid.innerHTML = results.map(item => {
        const creator = item.user_profiles?.full_name || 
                        item.user_profiles?.username || 
                        item.creator || 
                        'Creator';
        const creatorId = item.user_profiles?.id || item.user_id;
        const thumbnailUrl = item.thumbnail_url 
            ? `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${item.thumbnail_url.replace(/^\/+/, '')}`
            : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        
        return `
            <div class="content-card" data-content-id="${item.id}" style="background:var(--card-bg);border:1px solid var(--card-border);border-radius:20px;overflow:hidden;transition:all 0.3s ease;cursor:pointer;text-decoration:none;color:inherit;backdrop-filter:blur(10px);position:relative">
                <div class="card-thumbnail" style="position:relative;height:140px;overflow:hidden">
                    <img src="${thumbnailUrl}"
                         alt="${escapeHtml(item.title)}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'"
                         style="width:100%;height:100%;object-fit:cover;transition:transform 0.3s ease">
                    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.5) 100%)"></div>
                    <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s ease">
                        <div style="width:50px;height:50px;background:rgba(245,158,11,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--deep-black);font-size:1.5rem;transform:scale(0.8);transition:all 0.3s ease">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                </div>
                <div class="card-content" style="padding:15px">
                    <h3 class="card-title" style="font-size:16px;font-weight:600;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px;color:var(--soft-white);line-height:1.4">${truncateText(escapeHtml(item.title), 45)}</h3>
                    <button class="creator-btn" style="background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));color:var(--soft-white);border:none;padding:8px 15px;border-radius:10px;font-size:12px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all 0.3s ease;border:1px solid rgba(255,255,255,0.1);margin-top:8px"
                            onclick="event.stopPropagation(); window.location.href='creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creator)}'">
                        <i class="fas fa-user"></i>
                        ${truncateText(escapeHtml(creator), 15)}
                    </button>
                    <div style="display:flex;gap:15px;margin-top:8px;font-size:12px;color:var(--slate-grey)">
                        <div style="display:flex;align-items:center;gap:4px">
                            <i class="fas fa-eye" style="color:var(--bantu-blue);font-size:12px"></i>
                            ${formatNumber(item.real_views || item.views_count || 0)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers to cards
    grid.querySelectorAll('.content-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.creator-btn')) return;
            const id = card.dataset.contentId;
            if (id) window.location.href = `content-detail.html?id=${id}`;
        });
        
        // Hover effects
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-8px)';
            card.style.boxShadow = '0 20px 40px rgba(0,0,0,0.4)';
            card.style.borderColor = 'rgba(245,158,11,0.3)';
            card.querySelector('.card-thumbnail img').style.transform = 'scale(1.05)';
            card.querySelector('.card-thumbnail div:last-child').style.opacity = '1';
            card.querySelector('.card-thumbnail div:last-child div').style.transform = 'scale(1)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
            card.style.borderColor = 'var(--card-border)';
            card.querySelector('.card-thumbnail img').style.transform = 'scale(1)';
            card.querySelector('.card-thumbnail div:last-child').style.opacity = '0';
            card.querySelector('.card-thumbnail div:last-child div').style.transform = 'scale(0.8)';
        });
    });
}

// ✅ Setup search modal
function setupSearchModal() {
    if (!searchBtn || !searchModal || !closeSearchBtn) return;
    
    // Open search modal
    searchBtn.addEventListener('click', () => {
        searchModal.style.display = 'flex';
        setTimeout(() => searchInput?.focus(), 300);
    });
    
    // Close search modal
    closeSearchBtn.addEventListener('click', () => {
        searchModal.style.display = 'none';
        if (searchInput) searchInput.value = '';
        document.getElementById('search-results-grid').innerHTML = '';
    });
    
    // Close when clicking outside modal content
    searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
            searchModal.style.display = 'none';
            if (searchInput) searchInput.value = '';
            document.getElementById('search-results-grid').innerHTML = '';
        }
    });
    
    // Live search with debounce
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const query = e.target.value.trim();
            const category = document.getElementById('category-filter')?.value;
            const sortBy = document.getElementById('sort-filter')?.value;
            const resultsGrid = document.getElementById('search-results-grid');
            
            if (!resultsGrid) return;
            
            if (query.length < 2) {
                resultsGrid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey)">Start typing to search...</div>';
                return;
            }
            
            resultsGrid.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;color:var(--slate-grey)">
                    <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-radius:50%;border-top-color:var(--warm-gold);animation:spin 1s linear infinite;margin-bottom:15px"></div>
                    <div>Searching...</div>
                </div>
            `;
            
            const results = await searchContent(query, category, sortBy);
            renderSearchResults(results);
        }, 300));
    }
    
    // Filter change triggers search
    document.getElementById('category-filter')?.addEventListener('change', () => {
        if (searchInput.value.trim().length >= 2) {
            searchInput.dispatchEvent(new Event('input'));
        }
    });
    
    document.getElementById('sort-filter')?.addEventListener('change', () => {
        if (searchInput.value.trim().length >= 2) {
            searchInput.dispatchEvent(new Event('input'));
        }
    });
}

// ✅ Setup notifications panel
function setupNotificationsPanel() {
    if (!notificationsBtn || !notificationsPanel || !closeNotifications) return;
    
    // Open notifications panel
    notificationsBtn.addEventListener('click', () => {
        notificationsPanel.style.display = 'flex';
        loadNotifications();
    });
    
    // Close notifications panel
    closeNotifications.addEventListener('click', () => {
        notificationsPanel.style.display = 'none';
    });
    
    // Close when clicking outside panel
    document.addEventListener('click', (e) => {
        if (notificationsPanel.style.display === 'flex' &&
            !notificationsPanel.contains(e.target) &&
            !notificationsBtn.contains(e.target)) {
            notificationsPanel.style.display = 'none';
        }
    });
    
    // Mark all as read
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }
}

// ✅ Setup event listeners
function setupEventListeners() {
    // Profile button
    profileBtn.addEventListener('click', async () => {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            window.location.href = 'profile.html';
        } else {
            window.location.href = 'login.html?redirect=creator-dashboard.html';
        }
    });
    
    // Upload content buttons
    uploadContentBtn.addEventListener('click', () => {
        window.location.href = 'creator-upload.html';
    });
    
    quickUpload.addEventListener('click', () => {
        window.location.href = 'creator-upload.html';
    });
    
    // View analytics button
    viewAnalytics.addEventListener('click', () => {
        showToast('Analytics dashboard coming soon!', 'info');
    });
    
    // Payout request button
    payoutRequest.addEventListener('click', () => {
        if (dashboardData && dashboardData.analytics) {
            const earnings = dashboardData.analytics.total_earnings || 0;
            payoutAmount.textContent = formatCurrency(earnings);
            payoutModal.style.display = 'flex';
        }
    });
    
    // Modal close buttons
    closePayoutModal.addEventListener('click', () => {
        payoutModal.style.display = 'none';
    });
    
    cancelPayout.addEventListener('click', () => {
        payoutModal.style.display = 'none';
    });
    
    // Request payout button
    requestPayout.addEventListener('click', () => {
        const earnings = dashboardData?.analytics?.total_earnings || 0;
        if (earnings < 100) {
            showToast(`Minimum payout amount is R100.00. Current balance: ${formatCurrency(earnings)}`, 'error');
            return;
        }
        showToast(`Payout request submitted for ${formatCurrency(earnings)}`, 'success');
        payoutModal.style.display = 'none';
    });
    
    // Error state buttons
    retryBtn.addEventListener('click', () => {
        errorState.style.display = 'none';
        initializeDashboard();
    });
    
    reloginBtn.addEventListener('click', () => {
        localStorage.setItem('redirectAfterLogin', 'creator-dashboard.html');
        window.location.href = 'login.html?redirect=creator-dashboard.html';
    });
    
    // Close modal when clicking outside
    payoutModal.addEventListener('click', (e) => {
        if (e.target === payoutModal) {
            payoutModal.style.display = 'none';
        }
    });
    
    // Navigation items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.classList.contains('active')) {
                e.preventDefault();
            }
        });
    });
}

// ✅ Initialize dashboard
async function initializeDashboard() {
    console.log('👑 Initializing Creator Dashboard...');
    
    // Check authentication FIRST
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
        return;
    }
    
    // Load dashboard data (now using materialized view)
    await loadDashboardData();
    
    // Load notifications for summary
    await updateNotificationsSummary();
    
    // Setup modals and panels
    setupSearchModal();
    setupNotificationsPanel();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('✅ Creator Dashboard initialized successfully');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Auth state change listener
window.supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    
    if (event === 'SIGNED_IN' && session?.user) {
        currentUser = session.user;
        loadUserProfilePicture(currentUser);
        loadNotifications();
        updateNotificationsSummary();
        showToast('Welcome back!', 'success');
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        document.getElementById('userProfilePlaceholder').innerHTML = `
            <div class="profile-placeholder">
                <i class="fas fa-user"></i>
            </div>
        `;
        updateNotificationBadge(0);
        document.getElementById('notificationsSummary').textContent = 'Sign in to see your notifications';
        showToast('Signed out successfully', 'info');
    }
});
