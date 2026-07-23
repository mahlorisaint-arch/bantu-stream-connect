// js/creator-dashboard.js - Creator Dashboard JavaScript
// WITH JOURNALIST VERIFICATION MODULE + PHASE 5A + 5B ENHANCEMENTS

(function() {
    'use strict';
    
    console.log('📊 Creator Dashboard initializing...');

    // ============================================
    // GLOBAL STATE
    // ============================================
    let currentUser = null;
    let dashboardData = null;
    let isLoading = true;
    let notifications = [];
    let analyticsManager = null;
    let journalistApplication = null;
    let creatorProfile = null;

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const loadingScreen = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    const app = document.getElementById('app');
    const errorState = document.getElementById('errorState');
    const errorTitle = document.getElementById('errorTitle');
    const errorMessage = document.getElementById('errorMessage');
    // Renamed to match the canonical header's #current-profile-btn (Part 5
    // migration) — only used below as an existence guard before updating
    // #userProfilePlaceholder, not for click handling (shared-components.js's
    // own setupProfileDropdown() already owns this button's click behavior).
    const profileBtn = document.getElementById('current-profile-btn');

    // User Info Elements
    const creatorAvatar = document.getElementById('creatorAvatar');
    const creatorName = document.getElementById('creatorName');
    const connectorCount = document.getElementById('connectorCount');
    const founderBadge = document.getElementById('founderBadge');

    // Stats Elements
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
    // Payout Request is disabled entirely (see setupEventListeners) — no
    // element reference or click wiring needed here.
    const retryBtn = document.getElementById('retryBtn');
    const reloginBtn = document.getElementById('reloginBtn');

    // Search modal and notifications panel are now fully owned by
    // shared-components.js's own setupSearchModal()/setupNotifications()
    // (loaded platform-wide for the sidebar) — this page no longer keeps
    // local element references or a competing implementation for either,
    // since both would otherwise double-wire the same #search-btn/
    // #notifications-btn/#search-input/#notifications-list elements.

    // Journalist Verification Elements
    const journalistVerificationContainer = document.getElementById('journalist-verification-container');
    const journalistModal = document.getElementById('journalistModal');
    const closeJournalistModal = document.getElementById('closeJournalistModal');
    const cancelApplication = document.getElementById('cancelApplication');
    const submitApplication = document.getElementById('submitApplication');
    const journalistFullName = document.getElementById('journalistFullName');
    const journalistBio = document.getElementById('journalistBio');
    const journalistCountry = document.getElementById('journalistCountry');
    const journalistPublication = document.getElementById('journalistPublication');
    const portfolioLinks = document.getElementById('portfolioLinks');
    const addPortfolioLink = document.getElementById('addPortfolioLink');
    const portfolioLinksContainer = document.getElementById('portfolioLinksContainer');
    const documentFile = document.getElementById('documentFile');
    const uploadDocument = document.getElementById('uploadDocument');
    const documentUrl = document.getElementById('documentUrl');
    const applicationStatusText = document.getElementById('applicationStatusText');
    const applicationSubmittedDate = document.getElementById('applicationSubmittedDate');
    const rejectionReason = document.getElementById('rejectionReason');
    const reapplyBtn = document.getElementById('reapplyBtn');

    // ============================================
    // INITIALIZE SUPABASE CLIENT
    // ============================================
    if (!window.supabaseClient) {
        window.supabaseClient = supabase.createClient(
            'https://ydnxqnbjoshvxteevemc.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
        );
        console.log('✅ Global Supabase client initialized for creator dashboard');
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function setLoading(loading, text = '') {
        isLoading = loading;
        if (text && loadingText) loadingText.textContent = text;
        
        if (loading) {
            if (loadingScreen) loadingScreen.style.display = 'flex';
            if (app) app.style.display = 'none';
            if (errorState) errorState.style.display = 'none';
        } else {
            setTimeout(() => {
                if (loadingScreen) loadingScreen.style.display = 'none';
                if (app) app.style.display = 'block';
            }, 500);
        }
    }

    function showError(title, message) {
        if (errorTitle) errorTitle.textContent = title;
        if (errorMessage) errorMessage.textContent = message;
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (app) app.style.display = 'none';
        if (errorState) errorState.style.display = 'block';
    }

    function showToast(message, type = 'error') {
        const container = document.getElementById('toast-container');
        if (!container) {
            console.warn('Toast container not found');
            return;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        else if (type === 'error') icon = 'exclamation-circle';
        else if (type === 'warning') icon = 'exclamation-triangle';
        
        toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
        container.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 3000);
    }

    function formatCurrency(amount) {
        return 'R' + parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return (num || 0).toString();
    }

    function formatWatchTime(seconds) {
        if (!seconds) return '0h 0m';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return hours + 'h ' + mins + 'm';
        return mins + 'm';
    }

    function getInitials(email) {
        if (!email) return 'U';
        const parts = email.split('@')[0];
        return parts.substring(0, 2).toUpperCase();
    }

    function getInitialsFromName(fullName) {
        if (!fullName) return 'U';
        const names = fullName.split(' ');
        if (names.length >= 2) {
            return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
        }
        return fullName.charAt(0).toUpperCase();
    }

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

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // ============================================
    // JOURNALIST VERIFICATION MODULE
    // ============================================

    let portfolioLinksArray = [];

    function addPortfolioLinkField() {
        const linkDiv = document.createElement('div');
        linkDiv.className = 'portfolio-link-item';
        linkDiv.style.cssText = 'display:flex;gap:10px;margin-bottom:10px';
        linkDiv.innerHTML = `
            <input type="url" class="portfolio-link-input" placeholder="https://..." style="flex:1;padding:12px;border-radius:10px;background:rgba(255,255,255,0.1);border:1px solid var(--card-border);color:var(--soft-white)">
            <button type="button" class="remove-link-btn" style="padding:0 15px;border-radius:10px;background:rgba(239,68,68,0.2);border:1px solid var(--error-color);color:var(--error-color);cursor:pointer">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        const removeBtn = linkDiv.querySelector('.remove-link-btn');
        removeBtn.addEventListener('click', () => linkDiv.remove());
        
        portfolioLinksContainer.appendChild(linkDiv);
    }

    function collectPortfolioLinks() {
        const inputs = document.querySelectorAll('.portfolio-link-input');
        const links = [];
        inputs.forEach(input => {
            if (input.value && input.value.trim()) {
                links.push(input.value.trim());
            }
        });
        return links;
    }

    async function uploadDocumentFile(file) {
        if (!file) return null;
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const filePath = `journalist_documents/${fileName}`;
        
        const { data, error } = await window.supabaseClient.storage
            .from('creator-content')
            .upload(filePath, file);
        
        if (error) {
            console.error('Document upload error:', error);
            return null;
        }
        
        const { data: { publicUrl } } = window.supabaseClient.storage
            .from('creator-content')
            .getPublicUrl(filePath);
        
        return publicUrl;
    }

    async function loadJournalistStatus() {
        try {
            // Get creator profile
            const { data: profile, error: profileError } = await window.supabaseClient
                .from('creators')
                .select('is_journalist, is_verified, journalist_metadata')
                .eq('id', currentUser.id)
                .maybeSingle();
            
            if (profileError) throw profileError;
            creatorProfile = profile;
            
            // Get application if exists
            const { data: application, error: appError } = await window.supabaseClient
                .from('journalist_applications')
                .select('*')
                .eq('creator_id', currentUser.id)
                .maybeSingle();
            
            if (appError && appError.code !== 'PGRST116') throw appError;
            journalistApplication = application;
            
            // Render journalist verification UI based on state
            renderJournalistVerificationUI();
            
        } catch (error) {
            console.error('Error loading journalist status:', error);
        }
    }

    function renderJournalistVerificationUI() {
        if (!journalistVerificationContainer) return;
        
        // STATE 4: Verified Journalist
        if (creatorProfile && creatorProfile.is_journalist && creatorProfile.is_verified) {
            journalistVerificationContainer.innerHTML = `
                <div class="journalist-state verified-state">
                    <div class="verified-badge-large">
                        <i class="fas fa-check-circle"></i>
                        <span>Verified Journalist</span>
                    </div>
                    <div class="verified-info">
                        <p><i class="fas fa-newspaper"></i> You are a verified journalist on Bantu Stream Connect</p>
                        <p><i class="fas fa-badge-check"></i> Your content will display a verified badge</p>
                        <p><i class="fas fa-chart-line"></i> Access to exclusive journalist features</p>
                    </div>
                    <div class="verified-metadata">
                        <small>Verified on: ${creatorProfile.journalist_metadata?.verified_at ? new Date(creatorProfile.journalist_metadata.verified_at).toLocaleDateString() : 'Recently'}</small>
                    </div>
                </div>
            `;
            return;
        }
        
        // STATE 2: Application Pending
        if (journalistApplication && journalistApplication.status === 'pending') {
            journalistVerificationContainer.innerHTML = `
                <div class="journalist-state pending-state">
                    <div class="pending-icon">
                        <i class="fas fa-hourglass-half"></i>
                    </div>
                    <h3>Your application is under review</h3>
                    <p>Submitted: ${new Date(journalistApplication.created_at).toLocaleDateString()}</p>
                    <p>We'll notify you once it's reviewed.</p>
                    <button class="view-submission-btn" id="viewSubmissionBtn">
                        <i class="fas fa-file-alt"></i> View Submission
                    </button>
                </div>
            `;
            
            const viewSubmissionBtn = document.getElementById('viewSubmissionBtn');
            if (viewSubmissionBtn) {
                viewSubmissionBtn.addEventListener('click', () => {
                    showJournalistApplicationModal(true);
                });
            }
            return;
        }
        
        // STATE 3: Rejected
        if (journalistApplication && journalistApplication.status === 'rejected') {
            journalistVerificationContainer.innerHTML = `
                <div class="journalist-state rejected-state">
                    <div class="rejected-icon">
                        <i class="fas fa-times-circle"></i>
                    </div>
                    <h3>Your application was not approved</h3>
                    <div class="rejection-reason">
                        <strong>Reason:</strong> ${journalistApplication.rejection_reason || 'Insufficient portfolio or documentation'}
                    </div>
                    <button class="reapply-btn" id="reapplyJournalistBtn">
                        <i class="fas fa-redo-alt"></i> Re-apply
                    </button>
                </div>
            `;
            
            const reapplyJournalistBtn = document.getElementById('reapplyJournalistBtn');
            if (reapplyJournalistBtn) {
                reapplyJournalistBtn.addEventListener('click', () => {
                    showJournalistApplicationModal(false);
                });
            }
            return;
        }
        
        // STATE 1: Not a Journalist (Show CTA)
        journalistVerificationContainer.innerHTML = `
            <div class="journalist-state cta-state">
                <div class="cta-icon">
                    <i class="fas fa-user-graduate"></i>
                </div>
                <h3>Become a Verified Journalist</h3>
                <p>✓ Publish news articles</p>
                <p>✓ Build credibility</p>
                <p>✓ Reach wider audience</p>
                <button class="apply-now-btn" id="applyJournalistBtn">
                    <i class="fas fa-pen-fancy"></i> Apply Now
                </button>
            </div>
        `;
        
        const applyJournalistBtn = document.getElementById('applyJournalistBtn');
        if (applyJournalistBtn) {
            applyJournalistBtn.addEventListener('click', () => {
                showJournalistApplicationModal(false);
            });
        }
    }

    function showJournalistApplicationModal(viewOnly = false) {
        if (!journalistModal) return;
        
        if (viewOnly && journalistApplication) {
            // View only mode - show existing application
            document.getElementById('journalistModalTitle').textContent = 'Your Application';
            document.getElementById('journalistFullName').value = journalistApplication.full_name || '';
            document.getElementById('journalistBio').value = journalistApplication.bio || '';
            document.getElementById('journalistCountry').value = journalistApplication.country || '';
            document.getElementById('journalistPublication').value = journalistApplication.publication || '';
            
            // Display portfolio links
            const links = journalistApplication.portfolio_links || [];
            portfolioLinksContainer.innerHTML = '';
            links.forEach(link => {
                const linkDiv = document.createElement('div');
                linkDiv.className = 'portfolio-link-item';
                linkDiv.style.cssText = 'display:flex;gap:10px;margin-bottom:10px';
                linkDiv.innerHTML = `
                    <input type="url" class="portfolio-link-input" value="${escapeHtml(link)}" placeholder="https://..." style="flex:1;padding:12px;border-radius:10px;background:rgba(255,255,255,0.1);border:1px solid var(--card-border);color:var(--soft-white)" readonly>
                    <button type="button" class="remove-link-btn" style="display:none">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                portfolioLinksContainer.appendChild(linkDiv);
            });
            
            if (journalistApplication.document_url) {
                document.getElementById('documentUrl').value = journalistApplication.document_url;
                document.getElementById('uploadDocument').style.display = 'none';
            }
            
            // Disable inputs
            document.querySelectorAll('#journalistApplicationForm input, #journalistApplicationForm textarea, #journalistApplicationForm select')
                .forEach(el => el.disabled = true);
            
            submitApplication.style.display = 'none';
            cancelApplication.textContent = 'Close';
        } else {
            // New application mode
            document.getElementById('journalistModalTitle').textContent = 'Journalist Application';
            document.querySelectorAll('#journalistApplicationForm input, #journalistApplicationForm textarea, #journalistApplicationForm select')
                .forEach(el => el.disabled = false);
            
            // Clear form
            journalistFullName.value = '';
            journalistBio.value = '';
            journalistCountry.value = '';
            journalistPublication.value = '';
            portfolioLinksContainer.innerHTML = '';
            documentUrl.value = '';
            documentFile.value = '';
            uploadDocument.style.display = 'block';
            
            submitApplication.style.display = 'block';
            cancelApplication.textContent = 'Cancel';
            submitApplication.textContent = 'Submit Application';
        }
        
        journalistModal.style.display = 'flex';
    }

    async function submitJournalistApplication() {
        // Validate required fields
        if (!journalistFullName.value) {
            showToast('Please enter your full name', 'error');
            return;
        }
        if (!journalistBio.value) {
            showToast('Please enter your bio', 'error');
            return;
        }
        if (!journalistCountry.value) {
            showToast('Please select your country', 'error');
            return;
        }
        if (!journalistPublication.value) {
            showToast('Please enter your publication', 'error');
            return;
        }
        
        const portfolioLinksArray = collectPortfolioLinks();
        if (portfolioLinksArray.length === 0) {
            showToast('Please add at least one portfolio link', 'error');
            return;
        }
        
        let finalDocumentUrl = documentUrl.value;
        
        // Upload document if new file selected
        if (documentFile && documentFile.files && documentFile.files[0]) {
            const uploadedUrl = await uploadDocumentFile(documentFile.files[0]);
            if (uploadedUrl) {
                finalDocumentUrl = uploadedUrl;
            } else {
                showToast('Failed to upload document. Please try again.', 'error');
                return;
            }
        }
        
        if (!finalDocumentUrl) {
            showToast('Please upload a supporting document', 'error');
            return;
        }
        
        setLoading(true, 'Submitting application...');
        
        try {
            const { data, error } = await window.supabaseClient
                .from('journalist_applications')
                .insert({
                    creator_id: currentUser.id,
                    full_name: journalistFullName.value,
                    bio: journalistBio.value,
                    country: journalistCountry.value,
                    publication: journalistPublication.value,
                    portfolio_links: portfolioLinksArray,
                    document_url: finalDocumentUrl,
                    status: 'pending'
                })
                .select()
                .single();
            
            if (error) throw error;
            
            journalistApplication = data;
            journalistModal.style.display = 'none';
            renderJournalistVerificationUI();
            showToast('Application submitted successfully!', 'success');
            
        } catch (error) {
            console.error('Submission error:', error);
            showToast('Failed to submit application. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function setupJournalistVerification() {
        if (!journalistVerificationContainer) return;
        
        await loadJournalistStatus();
        
        // Modal close handlers
        if (closeJournalistModal) {
            closeJournalistModal.addEventListener('click', () => {
                journalistModal.style.display = 'none';
            });
        }
        
        if (cancelApplication) {
            cancelApplication.addEventListener('click', () => {
                journalistModal.style.display = 'none';
            });
        }
        
        if (submitApplication) {
            submitApplication.addEventListener('click', submitJournalistApplication);
        }
        
        if (addPortfolioLink) {
            addPortfolioLink.addEventListener('click', addPortfolioLinkField);
        }
        
        // Bug fix: this referenced an undeclared `uploadDocumentBtn` (no such
        // element exists — the real one is `uploadDocument`, already declared
        // above). Since this file runs 'use strict', that threw an uncaught
        // ReferenceError every time setupJournalistVerification() ran, which
        // silently aborted the rest of initializeDashboard() (setupSearchModal,
        // setupNotificationsPanel, setupEventListeners never ran). A duplicate
        // handler in creator-dashboard.html's inline script was silently
        // papering over the missing click wiring; that duplicate is removed
        // now that this is the one real handler.
        if (uploadDocument) {
            uploadDocument.addEventListener('click', () => {
                documentFile.click();
            });
        }

        if (documentFile) {
            documentFile.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    documentUrl.value = e.target.files[0].name;
                }
            });
        }
        
        // Close modal on outside click
        journalistModal.addEventListener('click', (e) => {
            if (e.target === journalistModal) {
                journalistModal.style.display = 'none';
            }
        });
    }

    // ============================================
    // PHASE 5: ANALYTICS INTEGRATION
    // ============================================

    async function initializeAnalyticsManager() {
        if (!window.CreatorAnalytics) {
            console.warn('⚠️ CreatorAnalytics module not loaded, using fallback');
            return null;
        }
        
        if (!currentUser) return null;
        
        try {
            const analytics = new window.CreatorAnalytics({
                supabase: window.supabaseClient,
                userId: currentUser.id,
                onDataLoaded: (data) => {
                    console.log('📊 Analytics data loaded:', data);
                },
                onError: (err) => {
                    console.error('❌ Analytics error:', err);
                }
            });
            
            console.log('✅ Analytics Manager initialized');
            return analytics;
        } catch (error) {
            console.error('❌ Failed to initialize Analytics Manager:', error);
            return null;
        }
    }

    async function loadContentAnalytics(contentId) {
        if (!analyticsManager) return null;
        
        try {
            const data = await analyticsManager.getContentAnalytics(contentId);
            return data;
        } catch (error) {
            console.error('❌ Failed to load content analytics:', error);
            return null;
        }
    }

    // ============================================
    // MAIN DASHBOARD FUNCTIONS
    // ============================================

    async function loadDashboardData() {
        try {
            setLoading(true, 'Loading dashboard data...');
            
            let analyticsData = null;
            let content = [];
            
            if (analyticsManager) {
                try {
                    const dashboardResult = await analyticsManager.getDashboardData('30days');
                    if (dashboardResult && !dashboardResult.error) {
                        analyticsData = {
                            total_uploads: dashboardResult.summary.totalUploads,
                            total_views: dashboardResult.summary.totalViews,
                            total_earnings: dashboardResult.summary.totalEarnings,
                            total_connectors: dashboardResult.summary.totalConnectors,
                            engagement_percentage: dashboardResult.summary.engagementPercentage,
                            is_eligible_for_monetization: dashboardResult.summary.isEligibleForMonetization
                        };
                        content = dashboardResult.content || [];
                        console.log('✅ Analytics data loaded via analytics manager');
                    }
                } catch (analyticsError) {
                    console.warn('Analytics manager failed, falling back:', analyticsError);
                }
            }
            
            if (!analyticsData) {
                try {
                    const { data, error } = await window.supabaseClient
                        .from('Content')
                        .select('*, user_profiles!user_id(*)')
                        .eq('user_id', currentUser.id)
                        .eq('status', 'published')
                        .order('created_at', { ascending: false })
                        .limit(50);
                    
                    if (error) throw error;
                    
                    content = data || [];

                    let totalViewsCount = 0;

                    for (const item of content) {
                        const { count } = await window.supabaseClient
                            .from('content_views')
                            .select('*', { count: 'exact', head: true })
                            .eq('content_id', item.id);

                        const viewsCount = count || 0;
                        totalViewsCount += viewsCount;
                        item.real_views = viewsCount;
                    }

                    const { count: connectorsCount } = await window.supabaseClient
                        .from('connectors')
                        .select('*', { count: 'exact', head: true })
                        .eq('connected_id', currentUser.id)
                        .eq('connection_type', 'creator');

                    // Real earnings from creator_earnings, not a fabricated
                    // views * 0.01 estimate (matches creator-analytics.js's
                    // _calculateSummary(), the working reference pattern).
                    const { data: earningsData } = await window.supabaseClient
                        .from('creator_earnings')
                        .select('amount')
                        .eq('creator_id', currentUser.id);
                    const totalEarningsAmount = (earningsData || []).reduce((sum, e) => sum + (e.amount || 0), 0);

                    analyticsData = {
                        total_uploads: content.length || 0,
                        total_views: totalViewsCount,
                        total_earnings: totalEarningsAmount,
                        total_connectors: connectorsCount || 0,
                        engagement_percentage: content.length > 0 ? (totalViewsCount / content.length) : 0,
                        is_eligible_for_monetization: content.length >= 10 && totalViewsCount >= 1000
                    };
                } catch (error) {
                    console.error('Error loading data:', error);
                    throw error;
                }
            }
            
            if (content.length === 0 && analyticsData.total_uploads > 0) {
                const { data: contentData, error: contentError } = await window.supabaseClient
                    .from('Content')
                    .select('*, user_profiles!user_id(*)')
                    .eq('user_id', currentUser.id)
                    .eq('status', 'published')
                    .order('created_at', { ascending: false })
                    .limit(20);
                
                if (!contentError && contentData) {
                    content = contentData;
                    for (const item of content) {
                        if (!item.real_views) {
                            const { count } = await window.supabaseClient
                                .from('content_views')
                                .select('*', { count: 'exact', head: true })
                                .eq('content_id', item.id);
                            item.real_views = count || 0;
                        }
                    }
                }
            }
            
            const { data: userProfile } = await window.supabaseClient
                .from('user_profiles')
                .select('*')
                .eq('id', currentUser.id)
                .maybeSingle();
            
            dashboardData = {
                user: {
                    name: userProfile?.full_name || 
                          userProfile?.username || 
                          currentUser.email?.split('@')[0] || 
                          'Creator',
                    avatar_url: userProfile?.avatar_url,
                    is_founder: userProfile?.is_founder || false
                },
                analytics: analyticsData,
                content: (content || []).slice(0, 5).map(item => ({
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
            
            updateUserInfo();
            updateStats();
            updateUploads();
            
            if (dashboardData.analytics.is_eligible_for_monetization) {
                showToast('🎉 You\'re eligible for monetization!', 'success');
            }
            
            setLoading(false);
        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
            showError('Loading Error', 'Failed to load dashboard data. Please refresh the page.');
        }
    }

    function updateUserInfo() {
        if (!dashboardData) return;
        
        const user = dashboardData.user;
        
        const displayName = user.name || (currentUser?.email?.split('@')[0]) || 'Creator';
        if (creatorName) creatorName.textContent = displayName;
        
        if (user.avatar_url && creatorAvatar) {
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
        
        const connectors = dashboardData.analytics.total_connectors || 10;
        if (connectorCount) {
            connectorCount.textContent = `${formatNumber(connectors)} Connector${connectors !== 1 ? 's' : ''}`;
        }
        
        if (founderBadge && user.is_founder) {
            founderBadge.style.display = 'flex';
        }
    }

    function updateStats() {
        if (!dashboardData) return;
        
        const analytics = dashboardData.analytics;
        
        if (totalUploads) totalUploads.textContent = formatNumber(analytics.total_uploads);
        if (totalViews) totalViews.textContent = formatNumber(analytics.total_views);
        if (totalEarnings) totalEarnings.textContent = formatCurrency(analytics.total_earnings);
        if (totalConnectors) totalConnectors.textContent = formatNumber(analytics.total_connectors);
    }

    function updateUploads() {
        if (!dashboardData || !uploadsContent) return;
        
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
        
        uploadsContent.innerHTML = content.map(item => {
            const statusClass = item.status === 'published' ? 'status-published' : 'status-draft';
            const statusText = item.status === 'published' ? 'Published' : 'Draft';
            return `
                <div class="upload-card" data-content-id="${item.id}" style="cursor: pointer;">
                    <h3 class="upload-title" title="${item.title}">
                        ${item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title}
                    </h3>
                    <div class="upload-status ${statusClass}">
                        ${statusText} • ${formatNumber(item.views)} views
                    </div>
                </div>
            `;
        }).join('');
        
        document.querySelectorAll('.upload-card').forEach(card => {
            card.addEventListener('click', async () => {
                const contentId = card.dataset.contentId;
                if (contentId) {
                    if (analyticsManager) {
                        await loadContentAnalytics(contentId);
                    }
                    window.location.href = `content-detail.html?id=${contentId}`;
                }
            });
        });
    }

    async function updateNotificationsSummary() {
        const summaryEl = document.getElementById('notificationsSummary');
        if (!summaryEl) return;
        
        try {
            if (!currentUser) {
                summaryEl.textContent = 'Sign in to see your notifications';
                return;
            }
            
            const { data: notificationsData, error } = await window.supabaseClient
                .from('notifications')
                .select('id, type, title, message, is_read, created_at, content_id, content_title, sender_name')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(5);
            
            if (error) throw error;
            
            const unreadCount = notificationsData.filter(n => !n.is_read).length;
            
            if (notificationsData.length === 0) {
                summaryEl.innerHTML = 'No new notifications. We\'ll notify you when fans interact with your content.';
                return;
            }
            
            let summaryHTML = `<div style="text-align:left">`;
            
            if (unreadCount > 0) {
                summaryHTML += `<div style="color:#F59E0B;font-weight:600;margin-bottom:10px">🔔 ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}</div>`;
            }
            
            notificationsData.slice(0, 3).forEach(notification => {
                const icon = getNotificationIcon(notification.type);
                const timeAgo = formatNotificationTime(notification.created_at);
                const title = notification.title || 'Notification';
                const message = notification.message || '';
                
                summaryHTML += `
                    <div style="padding:8px 0;border-bottom:1px solid var(--card-border)">
                        <div style="display:flex;align-items:start;gap:8px">
                            <div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-size:12px">
                                <i class="${icon}" style="font-size:10px"></i>
                            </div>
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:500;color:var(--soft-white);font-size:14px">${escapeHtml(title)}</div>
                                <div style="color:var(--slate-grey);font-size:13px;margin-top:2px">${escapeHtml(message)}</div>
                                <div style="color:var(--warm-gold);font-size:12px;margin-top:4px">${timeAgo}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            if (notificationsData.length > 3) {
                summaryHTML += `<div style="color:var(--warm-gold);margin-top:10px;font-size:14px">+${notificationsData.length - 3} more notifications</div>`;
            }
            
            summaryHTML += `</div>`;
            summaryEl.innerHTML = summaryHTML;
            
        } catch (error) {
            console.error('Error updating notifications summary:', error);
            summaryEl.textContent = 'Failed to load notifications. Please refresh.';
        }
    }

    async function loadUserProfilePicture(user) {
        try {
            if (!user || !profileBtn) return;
            
            const placeholder = document.getElementById('userProfilePlaceholder');
            if (!placeholder) return;
            
            while (placeholder.firstChild) {
                placeholder.removeChild(placeholder.firstChild);
            }
            
            const userInitials = getInitials(user.email);
            
            const { data: profile, error: profileError } = await window.supabaseClient
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            
            if (profileError) {
                const fallback = document.createElement('div');
                fallback.className = 'profile-placeholder';
                fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                fallback.textContent = userInitials;
                placeholder.appendChild(fallback);
                return;
            }
            
            if (profile) {
                const displayName = profile.full_name || profile.username || user.email || 'User';
                
                if (profile.avatar_url) {
                    let avatarUrl = profile.avatar_url;
                    
                    try {
                        if (!avatarUrl.startsWith('http')) {
                            if (avatarUrl.startsWith('avatars/')) {
                                avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${avatarUrl}`;
                            } else {
                                avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/avatars/${avatarUrl}`;
                            }
                        }
                        
                        const img = document.createElement('img');
                        img.className = 'profile-img';
                        img.alt = displayName;
                        img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
                        img.src = avatarUrl;
                        
                        img.onerror = () => {
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
                        const fallback = document.createElement('div');
                        fallback.className = 'profile-placeholder';
                        fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                        fallback.textContent = getInitialsFromName(displayName);
                        placeholder.appendChild(fallback);
                    }
                } else {
                    const nameInitials = profile.full_name ? getInitialsFromName(profile.full_name) : userInitials;
                    const fallback = document.createElement('div');
                    fallback.className = 'profile-placeholder';
                    fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                    fallback.textContent = nameInitials;
                    placeholder.appendChild(fallback);
                }
            } else {
                const fallback = document.createElement('div');
                fallback.className = 'profile-placeholder';
                fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                fallback.textContent = userInitials;
                placeholder.appendChild(fallback);
            }
        } catch (error) {
            console.error('Error loading user profile picture:', error);
        }
    }

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
            
            await loadUserProfilePicture(currentUser);
            
            return true;
        } catch (error) {
            console.error('❌ Authentication error:', error);
            return false;
        }
    }

    // loadNotifications/updateNotificationBadge/renderNotifications/
    // markNotificationAsRead/markAllNotificationsAsRead/searchContent/
    // renderSearchResults/setupSearchModal/setupNotificationsPanel all
    // removed: shared-components.js (loaded platform-wide for the sidebar)
    // already owns the real #search-modal and #notifications-panel via its
    // own setupSearchModal()/setupNotifications()/renderNotificationsList()/
    // markAllNotificationsAsRead()/updateNotificationBadge(). Keeping these
    // local duplicates would have double-wired the same #search-btn/
    // #notifications-btn/#search-input/#notifications-list elements once
    // shared-components.js was added. getNotificationIcon()/
    // formatNotificationTime() are kept - updateNotificationsSummary() (the
    // dashboard's own "Messages & Notifications" section) still uses them.

    function setupEventListeners() {
        // profileBtn's own click-to-navigate handler removed: it targeted a
        // #profile-btn id that no longer exists after the Part 5 header
        // migration, and it conflicted with shared-components.js's
        // setupProfileDropdown(), which already owns #current-profile-btn's
        // click behavior (opens the profile-switcher dropdown, not a
        // navigate-away — and 'profile.html' isn't a real page in this repo).

        if (uploadContentBtn) {
            uploadContentBtn.addEventListener('click', () => {
                window.location.href = 'creator-upload.html';
            });
        }
        
        if (quickUpload) {
            quickUpload.addEventListener('click', () => {
                window.location.href = 'creator-upload.html';
            });
        }
        
        if (viewAnalytics) {
            viewAnalytics.addEventListener('click', () => {
                window.location.href = 'creator-analytics.html';
            });
        }
        
        // Payout Request is disabled entirely for this pass (no real payout
        // processing exists) — the quick-action card is rendered as a
        // disabled, non-clickable card in creator-dashboard.html, and the
        // payout modal / requestPayout flow (which only ever showed a fake
        // "payout request submitted" toast, with no real Supabase write) has
        // been removed along with its modal markup.

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                if (errorState) errorState.style.display = 'none';
                initializeDashboard();
            });
        }
        
        if (reloginBtn) {
            reloginBtn.addEventListener('click', () => {
                localStorage.setItem('redirectAfterLogin', 'creator-dashboard.html');
                window.location.href = 'login.html?redirect=creator-dashboard.html';
            });
        }
        
    }

    async function initializeDashboard() {
        console.log('👑 Initializing Creator Dashboard with Journalist Verification...');
        
        const isAuthenticated = await checkAuthentication();
        if (!isAuthenticated) return;
        
        analyticsManager = await initializeAnalyticsManager();
        await loadDashboardData();
        await updateNotificationsSummary();
        await setupJournalistVerification();

        setupEventListeners();
        
        console.log('✅ Creator Dashboard initialized successfully');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDashboard);
    } else {
        initializeDashboard();
    }

    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
            currentUser = session.user;
            loadUserProfilePicture(currentUser);
            // Notification badge refresh on sign-in is now handled by
            // shared-components.js's own auth listener.
            updateNotificationsSummary();
            loadJournalistStatus();
            showToast('Welcome back!', 'success');
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            const placeholder = document.getElementById('userProfilePlaceholder');
            if (placeholder) {
                placeholder.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
            }
            const summaryEl = document.getElementById('notificationsSummary');
            if (summaryEl) {
                summaryEl.textContent = 'Sign in to see your notifications';
            }
            showToast('Signed out successfully', 'info');
        }
    });
})();
