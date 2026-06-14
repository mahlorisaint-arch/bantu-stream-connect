// js/content-detail/creator-section.js
// ============================================
// CREATOR SECTION MODULE
// Contains UI rendering for creator avatar/name navigation
// AND its specific database logic for connection status (connectors table)
// ============================================
console.log('🎬 Creator Section Module Loading...');

/**
 * Update creator avatar in UI (called from hero-section)
 * This is an alias for compatibility
 */
function updateCreatorAvatar(content) {
    const creatorAvatar = document.getElementById('creatorAvatar');
    if (!creatorAvatar || !content?.user_profiles) return;
    
    const avatarUrl = content.user_profiles.avatar_url;
    const displayName = content.user_profiles.full_name || content.user_profiles.username || (window.currentPlaylist?.creator_name || 'Creator');
    const initial = displayName.charAt(0).toUpperCase();
    
    if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined' && avatarUrl !== '') {
        const fixedAvatarUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
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

/**
 * Setup creator click navigation
 * Makes the creator section clickable to navigate to creator channel
 */
function setupCreatorClickNavigation() {
    const creatorSection = document.querySelector('.creator-section');
    const creatorInfo = document.querySelector('.creator-info');
    
    if (!creatorSection || !window.currentContent?.creator_id) return;
    
    creatorSection.style.cursor = 'pointer';
    
    if (creatorInfo) {
        const newCreatorInfo = creatorInfo.cloneNode(true);
        creatorInfo.parentNode.replaceChild(newCreatorInfo, creatorInfo);
        
        newCreatorInfo.addEventListener('click', function(e) {
            if (e.target.closest('.connect-btn')) return;
            const creatorName = window.currentContent?.creator_display_name || window.currentContent?.creator || 'Creator';
            window.location.href = `creator-channel.html?id=${window.currentContent.creator_id}&name=${encodeURIComponent(creatorName)}`;
        });
    }
}

/**
 * Update creator display name in UI
 */
function updateCreatorDisplayName(displayName) {
    if (displayName) {
        window.safeSetText('creatorName', displayName);
        window.safeSetText('creatorDisplayName', displayName);
    }
}

// ============================================
// CONNECTION BUTTONS - DATABASE LOGIC
// ============================================

/**
 * Check connection status between current user and creator
 * @param {string|number} creatorId - The creator's user ID
 * @returns {Promise<boolean>} True if connected, false otherwise
 */
async function checkConnectionStatus(creatorId) {
    return new Promise(async (resolve) => {
        if (!window.AuthHelper?.isAuthenticated?.() || !creatorId) {
            resolve(false);
            return;
        }
        
        const userProfile = window.AuthHelper.getUserProfile();
        if (!userProfile?.id) {
            resolve(false);
            return;
        }
        
        try {
            const { data, error } = await window.supabaseClient
                .from('connectors')
                .select('id')
                .eq('connector_id', userProfile.id)
                .eq('connected_id', creatorId)
                .maybeSingle();
            
            resolve(!error && data !== null);
        } catch (err) {
            console.warn('Connection check error:', err);
            resolve(false);
        }
    });
}

/**
 * Setup connect buttons with database insert/delete logic
 * Handles both #connectBtn and #connectCreatorBtn
 */
function setupConnectButtons() {
    const connectBtn = document.getElementById('connectBtn');
    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    const creatorId = window.currentContent?.creator_id;
    
    if (!creatorId) return;
    
    // Setup main connect button
    if (connectBtn) {
        // Initial status check
        checkConnectionStatus(creatorId).then((isConnected) => {
            if (isConnected) {
                connectBtn.classList.add('connected');
                connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });
        
        // Click handler
        const newConnectBtn = connectBtn.cloneNode(true);
        connectBtn.parentNode.replaceChild(newConnectBtn, connectBtn);
        
        newConnectBtn.addEventListener('click', async () => {
            await handleConnectionToggle(newConnectBtn, creatorId);
        });
    }
    
    // Setup secondary connect button (if exists)
    if (connectCreatorBtn) {
        checkConnectionStatus(creatorId).then((isConnected) => {
            if (isConnected) {
                connectCreatorBtn.classList.add('connected');
                connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });
        
        const newConnectCreatorBtn = connectCreatorBtn.cloneNode(true);
        connectCreatorBtn.parentNode.replaceChild(newConnectCreatorBtn, connectCreatorBtn);
        
        newConnectCreatorBtn.addEventListener('click', async () => {
            await handleConnectionToggle(newConnectCreatorBtn, creatorId);
        });
    }
}

/**
 * Handle connection toggle (insert/delete from connectors table)
 * @param {HTMLElement} buttonEl - The button element to update
 * @param {string|number} creatorId - The creator's user ID
 */
async function handleConnectionToggle(buttonEl, creatorId) {
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
        window.showToast('User profile not found', 'error');
        return;
    }
    
    const isConnected = buttonEl.classList.contains('connected');
    
    try {
        if (isConnected) {
            // DELETE: Remove connection
            const { error } = await window.supabaseClient
                .from('connectors')
                .delete()
                .eq('connector_id', userProfile.id)
                .eq('connected_id', creatorId);
            
            if (error) throw error;
            
            buttonEl.classList.remove('connected');
            buttonEl.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
            window.showToast('Disconnected', 'info');
            console.log(`✅ Connection removed between ${userProfile.id} and ${creatorId}`);
        } else {
            // INSERT: Add connection (check for existing first to prevent 409)
            const { data: existing } = await window.supabaseClient
                .from('connectors')
                .select('id')
                .eq('connector_id', userProfile.id)
                .eq('connected_id', creatorId)
                .maybeSingle();
            
            if (existing) {
                console.log('⚠️ Connection already exists, toggling off instead');
                const { error } = await window.supabaseClient
                    .from('connectors')
                    .delete()
                    .eq('id', existing.id);
                if (error) throw error;
                buttonEl.classList.remove('connected');
                buttonEl.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                window.showToast('Disconnected', 'info');
                return;
            }
            
            const { error } = await window.supabaseClient
                .from('connectors')
                .insert({
                    connector_id: userProfile.id,
                    connected_id: creatorId,
                    connection_type: 'creator'
                });
            
            if (error) throw error;
            
            buttonEl.classList.add('connected');
            buttonEl.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            window.showToast('Connected successfully!', 'success');
            console.log(`✅ Connection added between ${userProfile.id} and ${creatorId}`);
            
            // Track event if analytics available
            if (window.track?.userConnect) {
                window.track.userConnect(creatorId);
            }
        }
    } catch (error) {
        console.error('Connection update failed:', error);
        window.showToast('Failed to update connection', 'error');
    }
}

/**
 * Refresh connection button states (call after auth change)
 */
async function refreshConnectionButtons() {
    const creatorId = window.currentContent?.creator_id;
    if (!creatorId) return;
    
    const connectBtn = document.getElementById('connectBtn');
    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    
    const isConnected = await checkConnectionStatus(creatorId);
    
    if (connectBtn) {
        if (isConnected) {
            connectBtn.classList.add('connected');
            connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
        } else {
            connectBtn.classList.remove('connected');
            connectBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
        }
    }
    
    if (connectCreatorBtn) {
        if (isConnected) {
            connectCreatorBtn.classList.add('connected');
            connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
        } else {
            connectCreatorBtn.classList.remove('connected');
            connectCreatorBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
        }
    }
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

console.log('✅ Creator Section Module loaded');
