// js/content-detail/creator-section.js
// ============================================
// CREATOR SECTION MODULE - FIXED FOR BOTH SINGLE AND PLAYLIST MODES
// Contains UI rendering for creator avatar/name navigation
// AND its specific database logic for connection status (connectors table)
// ============================================
console.log('🎬 Creator Section Module Loading...');

// Store connection status cache
let creatorConnectionCache = new Map();

/**
 * Get current creator data from either single mode or playlist mode
 * @returns {Object|null} Creator data with id, name, avatar_url
 */
function getCurrentCreatorData() {
    // Try single mode first (window.currentContent)
    if (window.currentContent) {
        // Check different possible locations of creator data
        const creatorId = window.currentContent.creator_id || 
                         window.currentContent.user_id || 
                         window.currentContent.user_profiles?.id;
        
        const creatorName = window.currentContent.creator_display_name ||
                           window.currentContent.creator ||
                           window.currentContent.user_profiles?.full_name ||
                           window.currentContent.user_profiles?.username ||
                           (window.currentPlaylist?.creator_name) ||
                           'Creator';
        
        const creatorAvatar = window.currentContent.user_profiles?.avatar_url ||
                             window.currentPlaylist?.creator_avatar ||
                             null;
        
        if (creatorId) {
            return {
                id: creatorId,
                name: creatorName,
                avatar_url: creatorAvatar,
                user_profiles: window.currentContent.user_profiles
            };
        }
    }
    
    // Try playlist mode (window.currentPlaylist)
    if (window.currentPlaylist) {
        const creatorId = window.currentPlaylist.creator_id ||
                         window.currentPlaylist.user_id;
        
        const creatorName = window.currentPlaylist.creator_name ||
                           window.currentPlaylist.user_profiles?.full_name ||
                           window.currentPlaylist.user_profiles?.username ||
                           'Creator';
        
        const creatorAvatar = window.currentPlaylist.creator_avatar ||
                             window.currentPlaylist.user_profiles?.avatar_url ||
                             null;
        
        if (creatorId) {
            return {
                id: creatorId,
                name: creatorName,
                avatar_url: creatorAvatar,
                user_profiles: window.currentPlaylist.user_profiles
            };
        }
    }
    
    // Try playlist items (first item might have creator info)
    if (window.currentPlaylistItems && window.currentPlaylistItems.length > 0) {
        const firstItem = window.currentPlaylistItems[0];
        const creatorId = firstItem.creator_id || 
                         firstItem.user_id || 
                         firstItem.user_profiles?.id;
        
        const creatorName = firstItem.creator_display_name ||
                           firstItem.creator ||
                           firstItem.user_profiles?.full_name ||
                           firstItem.user_profiles?.username ||
                           (window.currentPlaylist?.creator_name) ||
                           'Creator';
        
        const creatorAvatar = firstItem.user_profiles?.avatar_url ||
                             window.currentPlaylist?.creator_avatar ||
                             null;
        
        if (creatorId) {
            return {
                id: creatorId,
                name: creatorName,
                avatar_url: creatorAvatar,
                user_profiles: firstItem.user_profiles
            };
        }
    }
    
    console.warn('⚠️ Could not find creator data in single or playlist mode');
    return null;
}

/**
 * Update creator avatar in UI (works for both modes)
 */
function updateCreatorAvatar() {
    const creatorAvatar = document.getElementById('creatorAvatar');
    if (!creatorAvatar) {
        console.warn('⚠️ creatorAvatar element not found');
        return;
    }
    
    const creatorData = getCurrentCreatorData();
    if (!creatorData) {
        console.warn('⚠️ No creator data available for avatar');
        return;
    }
    
    const avatarUrl = creatorData.avatar_url;
    const displayName = creatorData.name;
    const initial = displayName.charAt(0).toUpperCase();
    
    // Clear existing content
    creatorAvatar.innerHTML = '';
    
    if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined' && avatarUrl !== '') {
        const fixedAvatarUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
        const img = document.createElement('img');
        img.src = fixedAvatarUrl;
        img.alt = window.escapeHtml(displayName);
        img.style.cssText = 'width:100%; height:100%; border-radius:50%; object-fit:cover;';
        img.onerror = function() {
            this.style.display = 'none';
            const fallbackDiv = document.createElement('div');
            fallbackDiv.style.cssText = 'width:100%; height:100%; border-radius:50%; background:linear-gradient(135deg, #1D4ED8, #F59E0B); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:1.5rem;';
            fallbackDiv.textContent = initial;
            creatorAvatar.innerHTML = '';
            creatorAvatar.appendChild(fallbackDiv);
        };
        creatorAvatar.appendChild(img);
    } else {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.style.cssText = 'width:100%; height:100%; border-radius:50%; background:linear-gradient(135deg, #1D4ED8, #F59E0B); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:1.5rem;';
        fallbackDiv.textContent = initial;
        creatorAvatar.appendChild(fallbackDiv);
    }
    
    console.log('✅ Creator avatar updated for:', displayName, '(Mode: ' + (window.isPlaylistMode ? 'Playlist' : 'Single') + ')');
}

/**
 * Update creator display name in UI (works for both modes)
 */
function updateCreatorDisplayName() {
    const creatorData = getCurrentCreatorData();
    if (!creatorData) {
        console.warn('⚠️ No creator data available for display name');
        return;
    }
    
    const displayName = creatorData.name;
    
    // Update all possible creator name elements
    const creatorNameEl = document.getElementById('creatorName');
    const creatorDisplayNameEl = document.getElementById('creatorDisplayName');
    
    if (creatorNameEl) {
        creatorNameEl.textContent = displayName;
    }
    if (creatorDisplayNameEl) {
        creatorDisplayNameEl.textContent = displayName;
    }
    
    // Also update any other elements that might show creator name
    const creatorLabels = document.querySelectorAll('.creator-name, .creator-display-name');
    creatorLabels.forEach(el => {
        if (el.id !== 'creatorName' && el.id !== 'creatorDisplayName') {
            el.textContent = displayName;
        }
    });
    
    console.log('✅ Creator display name updated:', displayName);
}

/**
 * Setup creator click navigation - FIXED for both modes
 * Makes the entire creator section clickable to navigate to creator channel
 */
function setupCreatorClickNavigation() {
    const creatorData = getCurrentCreatorData();
    if (!creatorData?.id) {
        console.log('⚠️ No creator_id available, skipping click navigation setup');
        return;
    }
    
    // Find clickable containers - try multiple selectors
    const possibleContainers = [
        document.querySelector('.creator-section'),
        document.querySelector('.creator-info'),
        document.getElementById('creatorName')?.parentElement,
        document.getElementById('creatorAvatar')?.parentElement,
        document.querySelector('.creator-details'),
        document.querySelector('.creator-card')
    ];
    
    let clickableContainer = null;
    for (const container of possibleContainers) {
        if (container) {
            clickableContainer = container;
            break;
        }
    }
    
    if (!clickableContainer) {
        console.warn('⚠️ Creator clickable container not found');
        return;
    }
    
    // Remove any existing listeners (clone and replace)
    const newContainer = clickableContainer.cloneNode(true);
    clickableContainer.parentNode?.replaceChild(newContainer, clickableContainer);
    
    newContainer.style.cursor = 'pointer';
    newContainer.style.transition = 'opacity 0.2s ease';
    
    newContainer.addEventListener('click', function(e) {
        // Don't navigate if clicking on the connect button or its children
        if (e.target.closest('.connect-btn')) {
            console.log('🚫 Connect button clicked, not navigating to creator channel');
            return;
        }
        
        const creatorId = creatorData.id;
        const creatorName = encodeURIComponent(creatorData.name);
        
        if (creatorId) {
            console.log('🔗 Navigating to creator channel:', creatorId, creatorData.name);
            window.location.href = `creator-channel.html?id=${creatorId}&name=${creatorName}`;
        }
    });
    
    // Add hover effect
    newContainer.addEventListener('mouseenter', function() {
        this.style.opacity = '0.8';
    });
    newContainer.addEventListener('mouseleave', function() {
        this.style.opacity = '1';
    });
    
    console.log('✅ Creator click navigation setup complete (Mode: ' + (window.isPlaylistMode ? 'Playlist' : 'Single') + ')');
}

// ============================================
// CONNECTION BUTTONS - DATABASE LOGIC
// ============================================

/**
 * Check connection status between current user and creator
 * @returns {Promise<boolean>} True if connected, false otherwise
 */
async function checkConnectionStatus() {
    const creatorData = getCurrentCreatorData();
    if (!creatorData?.id) {
        console.log('⚠️ checkConnectionStatus: No creatorId available');
        return false;
    }
    
    const creatorId = creatorData.id;
    
    // Check cache first
    if (creatorConnectionCache.has(creatorId)) {
        const cached = creatorConnectionCache.get(creatorId);
        const now = Date.now();
        if (now - cached.timestamp < 30000) { // Cache for 30 seconds
            return cached.isConnected;
        }
    }
    
    if (!window.AuthHelper?.isAuthenticated?.()) {
        return false;
    }
    
    const userProfile = window.AuthHelper.getUserProfile();
    if (!userProfile?.id) {
        return false;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('connectors')
            .select('id')
            .eq('connector_id', userProfile.id)
            .eq('connected_id', creatorId)
            .maybeSingle();
        
        const isConnected = !error && data !== null;
        
        // Update cache
        creatorConnectionCache.set(creatorId, {
            isConnected: isConnected,
            timestamp: Date.now()
        });
        
        console.log(`🔗 Connection status for creator ${creatorId}: ${isConnected ? 'Connected' : 'Not connected'}`);
        return isConnected;
    } catch (err) {
        console.warn('Connection check error:', err);
        return false;
    }
}

/**
 * Setup connect buttons with database insert/delete logic
 * Handles both #connectBtn and #connectCreatorBtn - FIXED for both modes
 */
async function setupConnectButtons() {
    const connectBtn = document.getElementById('connectBtn');
    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    const creatorData = getCurrentCreatorData();
    
    if (!creatorData?.id) {
        console.log('⚠️ No creator_id available, skipping connect buttons setup');
        // Hide connect buttons if no creator
        if (connectBtn) connectBtn.style.display = 'none';
        if (connectCreatorBtn) connectCreatorBtn.style.display = 'none';
        return;
    }
    
    const creatorId = creatorData.id;
    console.log('🔧 Setting up connect buttons for creator:', creatorId, '(Mode: ' + (window.isPlaylistMode ? 'Playlist' : 'Single') + ')');
    
    // Show connect buttons
    if (connectBtn) connectBtn.style.display = '';
    if (connectCreatorBtn) connectCreatorBtn.style.display = '';
    
    // Helper to update button UI
    const updateButtonUI = async (button) => {
        if (!button) return;
        const isConnected = await checkConnectionStatus();
        if (isConnected) {
            button.classList.add('connected');
            button.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            button.setAttribute('data-connected', 'true');
            button.title = 'Disconnect from creator';
        } else {
            button.classList.remove('connected');
            button.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
            button.setAttribute('data-connected', 'false');
            button.title = 'Connect with creator';
        }
    };
    
    // Helper to handle connection toggle
    const handleConnectionClick = async (button) => {
        if (!button) return;
        
        const currentCreatorData = getCurrentCreatorData();
        if (!currentCreatorData?.id) {
            if (typeof window.showToast === 'function') {
                window.showToast('Creator information not available', 'error');
            }
            return;
        }
        
        const currentCreatorId = currentCreatorData.id;
        
        // Check authentication
        if (!window.AuthHelper?.isAuthenticated?.()) {
            const shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
            if (shouldLogin) {
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
            }
            return;
        }
        
        const userProfile = window.AuthHelper.getUserProfile();
        if (!userProfile?.id) {
            if (typeof window.showToast === 'function') {
                window.showToast('User profile not found', 'error');
            }
            return;
        }
        
        const isCurrentlyConnected = button.classList.contains('connected');
        
        // Disable button during operation
        const originalHTML = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Processing...</span>';
        
        try {
            if (isCurrentlyConnected) {
                // DELETE: Remove connection
                const { error } = await window.supabaseClient
                    .from('connectors')
                    .delete()
                    .eq('connector_id', userProfile.id)
                    .eq('connected_id', currentCreatorId);
                
                if (error) throw error;
                
                // Invalidate cache
                creatorConnectionCache.delete(currentCreatorId);
                
                button.classList.remove('connected');
                button.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                button.setAttribute('data-connected', 'false');
                
                if (typeof window.showToast === 'function') {
                    window.showToast('Disconnected from creator', 'info');
                }
                console.log(`✅ Connection removed between ${userProfile.id} and ${currentCreatorId}`);
            } else {
                // Check for existing connection first (prevent 409)
                const { data: existing } = await window.supabaseClient
                    .from('connectors')
                    .select('id')
                    .eq('connector_id', userProfile.id)
                    .eq('connected_id', currentCreatorId)
                    .maybeSingle();
                
                if (existing) {
                    console.log('⚠️ Connection already exists, toggling off instead');
                    const { error } = await window.supabaseClient
                        .from('connectors')
                        .delete()
                        .eq('id', existing.id);
                    if (error) throw error;
                    creatorConnectionCache.delete(currentCreatorId);
                    button.classList.remove('connected');
                    button.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    if (typeof window.showToast === 'function') {
                        window.showToast('Disconnected from creator', 'info');
                    }
                    return;
                }
                
                // INSERT: Add connection
                const { error } = await window.supabaseClient
                    .from('connectors')
                    .insert({
                        connector_id: userProfile.id,
                        connected_id: currentCreatorId,
                        connection_type: 'creator',
                        created_at: new Date().toISOString()
                    });
                
                if (error) throw error;
                
                // Invalidate cache
                creatorConnectionCache.delete(currentCreatorId);
                
                button.classList.add('connected');
                button.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                button.setAttribute('data-connected', 'true');
                
                if (typeof window.showToast === 'function') {
                    window.showToast('Connected successfully!', 'success');
                }
                console.log(`✅ Connection added between ${userProfile.id} and ${currentCreatorId}`);
                
                // Track event if analytics available
                if (window.track?.userConnect) {
                    window.track.userConnect(currentCreatorId);
                }
            }
        } catch (error) {
            console.error('Connection update failed:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Failed to update connection', 'error');
            }
            // Restore original UI
            button.innerHTML = originalHTML;
        } finally {
            button.disabled = false;
            // Refresh UI after a short delay
            setTimeout(() => updateButtonUI(button), 500);
        }
    };
    
    // Setup main connect button
    if (connectBtn) {
        // Clone and replace to remove existing listeners
        const newConnectBtn = connectBtn.cloneNode(true);
        connectBtn.parentNode?.replaceChild(newConnectBtn, connectBtn);
        
        // Set initial UI
        await updateButtonUI(newConnectBtn);
        
        // Add click handler
        newConnectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleConnectionClick(newConnectBtn);
        });
        
        console.log('✅ Main connect button setup complete');
    }
    
    // Setup secondary connect button (if exists)
    if (connectCreatorBtn) {
        const newConnectCreatorBtn = connectCreatorBtn.cloneNode(true);
        connectCreatorBtn.parentNode?.replaceChild(newConnectCreatorBtn, connectCreatorBtn);
        
        await updateButtonUI(newConnectCreatorBtn);
        
        newConnectCreatorBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleConnectionClick(newConnectCreatorBtn);
        });
        
        console.log('✅ Secondary connect button setup complete');
    }
}

/**
 * Refresh connection button states (call after auth change or content change)
 */
async function refreshConnectionButtons() {
    const creatorData = getCurrentCreatorData();
    if (!creatorData?.id) {
        console.log('⚠️ No creator_id available for refresh');
        const connectBtn = document.getElementById('connectBtn');
        const connectCreatorBtn = document.getElementById('connectCreatorBtn');
        if (connectBtn) connectBtn.style.display = 'none';
        if (connectCreatorBtn) connectCreatorBtn.style.display = 'none';
        return;
    }
    
    // Show buttons
    const connectBtn = document.getElementById('connectBtn');
    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    if (connectBtn) connectBtn.style.display = '';
    if (connectCreatorBtn) connectCreatorBtn.style.display = '';
    
    // Invalidate cache
    creatorConnectionCache.delete(creatorData.id);
    
    const updateButton = async (button) => {
        if (!button) return;
        const isConnected = await checkConnectionStatus();
        if (isConnected) {
            button.classList.add('connected');
            button.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            button.setAttribute('data-connected', 'true');
        } else {
            button.classList.remove('connected');
            button.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
            button.setAttribute('data-connected', 'false');
        }
    };
    
    await Promise.all([updateButton(connectBtn), updateButton(connectCreatorBtn)]);
    console.log('✅ Connection buttons refreshed');
}

// ============================================================
// DYNAMIC 3D CRYSTALLINE IDENTITY TOKEN RENDER ENGINE (v4.1)
// ============================================================

/**
 * Get creator verification details and metadata
 * Checks distinct tiers: Founder vs Standard Verified Creator
 * @param {string} creatorId - The creator's user ID
 * @returns {Promise<Object>} Verification metrics
 */
async function getCreatorVerificationDetails(creatorId) {
    const fallbackState = { isVerified: false, badgeClass: null, label: null };
    if (!creatorId) return fallbackState;
    
    try {
        const { data, error } = await window.supabaseClient
            .from('creators')
            .select('is_verified, is_creator_verified, is_founder, is_journalist, is_educator')
            .eq('id', creatorId)
            .maybeSingle();
        
        if (error) throw error;
        if (!data) return fallbackState;

        // Priority Tier 1: Founder Status (Bantu Brand Core)
        if (data.is_founder) {
            return { isVerified: true, badgeClass: 'founder-verified', label: 'Founder' };
        }
        
        // Priority Tier 2: Explicit Creator Verification
        if (data.is_creator_verified) {
            return { isVerified: true, badgeClass: 'creator-verified', label: 'Verified Creator' };
        }

        // Priority Tier 3: Legacy Global Verification Fallback
        if (data.is_verified) {
            return { isVerified: true, badgeClass: 'standard-verified', label: 'Verified' };
        }

        // If no flags are true, return unverified state
        return fallbackState;
    } catch (err) {
        console.warn('Error reading verification detailed record:', err);
        return fallbackState;
    }
}

/**
 * Render 3D Crystalline Identity Token with holographic display
 * Builds the exact visual states from design specifications
 * Uses production-ready SVG paths matching the visual asset silhouettes
 * @param {string} creatorId - The creator's user ID
 * @param {HTMLElement} badgeContainer - Container where badge renders
 */
async function renderVerificationBadge(creatorId, badgeContainer) {
    if (!badgeContainer) {
        console.warn('⚠️ renderVerificationBadge: No container provided');
        return;
    }
    
    // Clear container
    badgeContainer.innerHTML = '';
    
    const details = await getCreatorVerificationDetails(creatorId);
    if (!details.isVerified) return;

    let cardTier = 'verified-card';
    let baseIcon = 'fa-solid fa-check';
    
    // Accurate, production-ready SVG paths matching the visual asset silhouettes
    let internalSvgGlow = '';
    
    // Exact Africa Silhouette Outline shared across templates
    const africaPath = `M48 24c2.5-.6 6.5-1.2 8.7-.3 4 .1 6.2 1.2 10.2 4.3 2.1 2.1 4.6 7.5 3.4 11.5-1.5 4-6.8 6.2-8.7 9.3-1.8 3.1-4 7.1-5 11.5-.6 2.5-2.1 7.1-4.3 8.1-.9.6-3.1-.9-4-4-.9-3.1-4-7.1-5.3-10.9-1.8-4.6-4-6.8-8.1-7.8-3.7-.9-6.2-2.8-7.5-6.8-.9-3.1-3.1-5.3-1.8-8.4.9-2.1 5-3.1 8.1-1.8 2.1.9 4.3-.3 7.5-2.2z`;

    if (details.badgeClass === 'founder-verified') {
        cardTier = 'founder-card';
        baseIcon = 'fa-solid fa-gem';
        // Founder Tier: Africa + Internal Poly-Mesh & Core Soundwaves
        internalSvgGlow = `
            <g class="holo-layer">
                <path d="${africaPath}" stroke="var(--primary)" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
                
                <path d="M42 46a7 7 0 0 1 11 0" stroke="var(--glow)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                <path d="M39 42a12 12 0 0 1 17 0" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                
                <path d="M48,24 L42,35 L52,32 L64,28 M42,35 L35,40 L39,52 M52,32 L56,48 L48,60" stroke="rgba(255,255,255,0.12)" stroke-width="0.5" fill="none"/>
                <circle cx="48" cy="24" r="1.5" fill="var(--glow)"/>
                <circle cx="42" cy="35" r="1.5" fill="var(--glow)"/>
                <circle cx="56" cy="48" r="1.5" fill="var(--glow)"/>
            </g>`;
    } else if (details.badgeClass === 'creator-verified') {
        cardTier = 'creator-card';
        baseIcon = 'fa-solid fa-tower-broadcast';
        // Creator Tier: Africa with both integrated internal signal lines and external right-side broadcast waves
        internalSvgGlow = `
            <g class="holo-layer">
                <path d="${africaPath}" stroke="var(--primary)" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
                
                <path d="M42 46a7 7 0 0 1 11 0" stroke="var(--glow)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                <path d="M39 42a12 12 0 0 1 17 0" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                
                <path d="M70 32a14 14 0 0 1 0 24" stroke="var(--glow)" stroke-width="2" stroke-linecap="round" fill="none"/>
                <path d="M76 25a22 22 0 0 1 0 38" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </g>`;
    } else {
        cardTier = 'verified-card';
        baseIcon = 'fa-solid fa-check';
        // Verified Tier: Africa + Signal waves encapsulated cleanly inside the Crystalline Glass Orb
        internalSvgGlow = `
            <g class="holo-layer">
                <circle cx="50" cy="50" r="38" stroke="var(--primary)" stroke-width="1.25" fill="none" opacity="0.4"/>
                
                <g transform="translate(2, 2) scale(0.96)">
                    <path d="${africaPath}" stroke="var(--glow)" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
                    
                    <path d="M42 46a7 7 0 0 1 11 0" stroke="var(--glow)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                    <path d="M39 42a12 12 0 0 1 17 0" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                </g>
            </g>`;
    }

    // Build the structural 3D Monolith Token
    const tokenCard = document.createElement('div');
    tokenCard.className = `bsc-identity-token ${cardTier}`;
    
    tokenCard.innerHTML = `
        <div class="token-border-glow"></div>
        <div class="token-emitter-platform"></div>
        
        <div class="token-hologram-container">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                ${internalSvgGlow}
            </svg>
        </div>
        
        <div class="token-title">${details.label}</div>
        <div class="token-subtitle">Verified</div>
        
        <div class="token-base-emblem">
            <i class="${baseIcon}"></i>
        </div>
    `;

    badgeContainer.appendChild(tokenCard);
    console.log('✅ 3D Crystalline Identity Token rendered for:', details.label);
}

// ============================================
// INITIALIZE CREATOR SECTION
// ============================================

/**
 * Initialize entire creator section
 * Call this after content is loaded (works for both single and playlist modes)
 */
async function initCreatorSection() {
    console.log('🎬 Initializing creator section... (Mode: ' + (window.isPlaylistMode ? 'Playlist' : 'Single') + ')');
    
    const creatorData = getCurrentCreatorData();
    if (!creatorData) {
        console.warn('⚠️ No creator data available for creator section');
        // Hide creator section if no creator
        const creatorSection = document.querySelector('.creator-section');
        if (creatorSection) creatorSection.style.display = 'none';
        return;
    }
    
    // Show creator section
    const creatorSection = document.querySelector('.creator-section');
    if (creatorSection) creatorSection.style.display = '';
    
    // Update creator avatar and name
    updateCreatorAvatar();
    updateCreatorDisplayName();
    
    // Setup click navigation
    setupCreatorClickNavigation();
    
    // Setup connect buttons
    await setupConnectButtons();
    
    console.log('✅ Creator section initialized for creator:', creatorData.name);
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.updateCreatorAvatar = updateCreatorAvatar;
window.setupCreatorClickNavigation = setupCreatorClickNavigation;
window.setupConnectButtons = setupConnectButtons;
window.checkConnectionStatus = checkConnectionStatus;
window.refreshConnectionButtons = refreshConnectionButtons;
window.updateCreatorDisplayName = updateCreatorDisplayName;
window.initCreatorSection = initCreatorSection;
window.getCurrentCreatorData = getCurrentCreatorData;
window.getCreatorVerificationDetails = getCreatorVerificationDetails;
window.renderVerificationBadge = renderVerificationBadge;

// Auto-initialize when content is ready
function attemptAutoInit() {
    if (window.currentContent || window.currentPlaylist || (window.currentPlaylistItems && window.currentPlaylistItems.length > 0)) {
        console.log('🎬 Auto-initializing creator section');
        initCreatorSection();
        return true;
    }
    return false;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait a bit for currentContent/playlist to be set
        setTimeout(() => {
            if (!attemptAutoInit()) {
                // Try again after a longer delay
                setTimeout(attemptAutoInit, 1000);
            }
        }, 500);
    });
} else {
    setTimeout(() => {
        if (!attemptAutoInit()) {
            setTimeout(attemptAutoInit, 1000);
        }
    }, 500);
}

// Listen for content changes (single mode)
window.addEventListener('contentIdChanged', () => {
    console.log('🔄 Content changed, re-initializing creator section');
    setTimeout(() => initCreatorSection(), 300);
});

// Listen for playlist changes
window.addEventListener('playlistLoaded', () => {
    console.log('🔄 Playlist loaded, re-initializing creator section');
    setTimeout(() => initCreatorSection(), 300);
});

// Also listen for when playlist mode is set
const originalSetCurrentContent = window.setCurrentContent;
if (originalSetCurrentContent) {
    window.setCurrentContent = async function(content, index) {
        await originalSetCurrentContent(content, index);
        setTimeout(() => initCreatorSection(), 200);
    };
}

// ============================================================
// SAFE DYNAMIC INITIALIZATION (Listens to Content Lifecycle)
// ============================================================
function triggerIsolatedBadgeInjected() {
    try {
        // Find the "Joined 2024" container safely
        const subHeaderContainer = document.querySelector('.creator-subtext-metadata');
        if (!subHeaderContainer) return;

        // Pull the freshly hydrated creator ID from the platform state metrics
        const creatorId = window.currentContentItem?.creator_id || 
                          (window.getCurrentCreatorData ? window.getCurrentCreatorData()?.id : null);
        
        // If the platform state isn't ready yet, skip and wait for the structural update event
        if (!creatorId) return; 

        // Run the glassmorphic badge injector safely
        renderVerificationBadge(creatorId, subHeaderContainer);
    } catch (autoInitError) {
        // Defensive isolation barrier
        console.warn('Creator badge injection deferred safely:', autoInitError.message);
    }
}

// 1. Check immediately on window load state
window.addEventListener('load', triggerIsolatedBadgeInjected);

// 2. ALSO listen to your player engine's content sync event to capture dynamic updates
window.addEventListener('contentIdChanged', triggerIsolatedBadgeInjected);

// 3. Fallback: Run when your creator module prints its successful initialization log
if (window.supabaseClient) {
    // Check every 600ms for the creator container element to load, max 5 attempts
    let checkAttempts = 0;
    const corePollingCheck = setInterval(() => {
        checkAttempts++;
        const targetElement = document.querySelector('.creator-subtext-metadata');
        const activeId = window.currentContentItem?.creator_id || (window.getCurrentCreatorData ? window.getCurrentCreatorData()?.id : null);
        
        if (targetElement && activeId) {
            triggerIsolatedBadgeInjected();
            clearInterval(corePollingCheck);
        }
        if (checkAttempts >= 5) clearInterval(corePollingCheck);
    }, 600);
}

console.log('✅ Creator Section Module loaded (Fully fixed for Single + Playlist modes + 3D Crystalline Identity Tokens v4.1)');
