// js/content-detail/creator-section.js
// Extracted from content-detail.js - Creator Section Management

console.log('👤 Creator Section module loading...');

// ============================================
// UPDATE CREATOR AVATAR IN SECTION
// ============================================
function updateCreatorAvatar(content) {
    const creatorAvatar = document.getElementById('creatorAvatar');
    if (!creatorAvatar) return;
    
    if (content && content.user_profiles) {
        const avatarUrl = content.user_profiles.avatar_url;
        const displayName = content.user_profiles.full_name || content.user_profiles.username || 
                           (window.currentPlaylist?.creator_name || 'Creator');
        const initial = displayName.charAt(0).toUpperCase();
        
        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined' && avatarUrl !== '') {
            const fixedAvatarUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
            creatorAvatar.innerHTML = `
                <img src="${fixedAvatarUrl}" 
                     alt="${escapeHtml(displayName)}" 
                     style="width:100%; height:100%; border-radius:50%; object-fit:cover;"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231D4ED8%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22Arial%22>${initial}</text></svg>'">
            `;
            console.log('✅ Creator avatar set from URL:', fixedAvatarUrl);
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
            console.log('✅ Creator avatar fallback to initials:', initial);
        }
    } else {
        // Fallback for guest or no profile
        creatorAvatar.innerHTML = '<i class="fas fa-user"></i>';
    }
}

// ============================================
// SETUP CREATOR CLICK NAVIGATION
// ============================================
function setupCreatorClickNavigation(content) {
    const creatorSection = document.querySelector('.creator-section');
    const creatorInfo = document.querySelector('.creator-info');
    
    if (creatorSection && content && content.creator_id) {
        creatorSection.style.cursor = 'pointer';
        
        if (creatorInfo) {
            const newCreatorInfo = creatorInfo.cloneNode(true);
            creatorInfo.parentNode.replaceChild(newCreatorInfo, creatorInfo);
            
            newCreatorInfo.addEventListener('click', function(e) {
                // Don't navigate if clicking the connect button
                if (e.target.closest('.connect-btn')) return;
                
                const creatorName = content.creator_display_name || content.creator || 'Creator';
                window.location.href = `creator-channel.html?id=${content.creator_id}&name=${encodeURIComponent(creatorName)}`;
            });
        }
    }
}

// ============================================
// SETUP CONNECT BUTTONS
// ============================================
function setupConnectButtons() {
    // Check connection status helper
    function checkConnectionStatus(creatorId) {
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
    
    // Setup main connect button
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn && window.currentContent?.creator_id) {
        checkConnectionStatus(window.currentContent.creator_id).then(function(isConnected) {
            if (isConnected) {
                connectBtn.classList.add('connected');
                connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });
        
        connectBtn.addEventListener('click', async function() {
            if (!window.AuthHelper?.isAuthenticated?.()) {
                const shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
                if (shouldLogin) {
                    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                }
                return;
            }
            
            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                if (typeof showToast === 'function') {
                    showToast('User profile not found', 'error');
                }
                return;
            }
            
            const isConnected = connectBtn.classList.contains('connected');
            
            try {
                if (isConnected) {
                    const { error } = await window.supabaseClient
                        .from('connectors')
                        .delete()
                        .eq('connector_id', userProfile.id)
                        .eq('connected_id', window.currentContent.creator_id);
                    if (error) throw error;
                    
                    connectBtn.classList.remove('connected');
                    connectBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    if (typeof showToast === 'function') {
                        showToast('Disconnected', 'info');
                    }
                } else {
                    const { error } = await window.supabaseClient
                        .from('connectors')
                        .insert({
                            connector_id: userProfile.id,
                            connected_id: window.currentContent.creator_id,
                            connection_type: 'creator'
                        });
                    if (error) throw error;
                    
                    connectBtn.classList.add('connected');
                    connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                    if (typeof showToast === 'function') {
                        showToast('Connected successfully!', 'success');
                    }
                    if (window.track?.userConnect) {
                        window.track.userConnect(window.currentContent.creator_id);
                    }
                }
            } catch (error) {
                console.error('Connection update failed:', error);
                if (typeof showToast === 'function') {
                    showToast('Failed to update connection', 'error');
                }
            }
        });
    }
    
    // Setup creator section connect button
    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    if (connectCreatorBtn && window.currentContent?.creator_id) {
        checkConnectionStatus(window.currentContent.creator_id).then(function(isConnected) {
            if (isConnected) {
                connectCreatorBtn.classList.add('connected');
                connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });
        
        connectCreatorBtn.addEventListener('click', async function() {
            if (!window.AuthHelper?.isAuthenticated?.()) {
                const shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
                if (shouldLogin) {
                    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                }
                return;
            }
            
            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                if (typeof showToast === 'function') {
                    showToast('User profile not found', 'error');
                }
                return;
            }
            
            const isConnected = connectCreatorBtn.classList.contains('connected');
            
            try {
                if (isConnected) {
                    const { error } = await window.supabaseClient
                        .from('connectors')
                        .delete()
                        .eq('connector_id', userProfile.id)
                        .eq('connected_id', window.currentContent.creator_id);
                    if (error) throw error;
                    
                    connectCreatorBtn.classList.remove('connected');
                    connectCreatorBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    if (typeof showToast === 'function') {
                        showToast('Disconnected', 'info');
                    }
                } else {
                    const { error } = await window.supabaseClient
                        .from('connectors')
                        .insert({
                            connector_id: userProfile.id,
                            connected_id: window.currentContent.creator_id,
                            connection_type: 'creator'
                        });
                    if (error) throw error;
                    
                    connectCreatorBtn.classList.add('connected');
                    connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                    if (typeof showToast === 'function') {
                        showToast('Connected successfully!', 'success');
                    }
                    if (window.track?.userConnect) {
                        window.track.userConnect(window.currentContent.creator_id);
                    }
                }
            } catch (error) {
                console.error('Connection update failed:', error);
                if (typeof showToast === 'function') {
                    showToast('Failed to update connection', 'error');
                }
            }
        });
    }
}

// ============================================
// UPDATE CREATOR DISPLAY NAME
// ============================================
function updateCreatorDisplayName(content) {
    const creatorName = content?.creator_display_name || content?.creator || 
                       content?.user_profiles?.full_name || content?.user_profiles?.username || 'Creator';
    safeSetText('creatorDisplayName', creatorName);
    safeSetText('creatorName', creatorName);
}

// ============================================
// SAFE SET TEXT UTILITY
// ============================================
function safeSetText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text || '';
}

// ============================================
// ESCAPE HTML UTILITY
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// EXPORTS FOR GLOBAL ACCESS
// ============================================
window.updateCreatorAvatar = updateCreatorAvatar;
window.setupCreatorClickNavigation = setupCreatorClickNavigation;
window.setupConnectButtons = setupConnectButtons;
window.updateCreatorDisplayName = updateCreatorDisplayName;

console.log('✅ Creator Section module loaded');
