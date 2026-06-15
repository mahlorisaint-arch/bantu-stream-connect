// js/content-detail/creator-section.js
// ============================================
// CREATOR SECTION MODULE - FULLY FIXED
// Contains UI rendering for creator avatar/name navigation
// AND its specific database logic for connection status (connectors table)
// ============================================
console.log('🎬 Creator Section Module Loading...');

// Store connection status cache
let creatorConnectionCache = new Map();

/**
 * Update creator avatar in UI
 */
function updateCreatorAvatar(content) {
    const creatorAvatar = document.getElementById('creatorAvatar');
    if (!creatorAvatar || !content?.user_profiles) return;
    
    const avatarUrl = content.user_profiles.avatar_url;
    const displayName = content.user_profiles.full_name || content.user_profiles.username || (window.currentPlaylist?.creator_name || 'Creator');
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
    
    console.log('✅ Creator avatar updated for:', displayName);
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

/**
 * Setup creator click navigation - FIXED to work properly
 * Makes the entire creator section clickable to navigate to creator channel
 */
function setupCreatorClickNavigation() {
    const creatorSection = document.querySelector('.creator-section');
    const creatorInfo = document.querySelector('.creator-info');
    
    // Also try to get the creator name element if the above don't exist
    const creatorNameEl = document.getElementById('creatorName');
    const creatorAvatar = document.getElementById('creatorAvatar');
    
    if (!window.currentContent?.creator_id) {
        console.log('⚠️ No creator_id available, skipping click navigation setup');
        return;
    }
    
    // Find the clickable container - try multiple selectors
    let clickableContainer = creatorSection || creatorInfo || creatorNameEl?.parentElement || creatorAvatar?.parentElement;
    
    if (!clickableContainer) {
        console.warn('⚠️ Creator clickable container not found, creating one');
        // Create a wrapper if none exists
        const heroActions = document.querySelector('.hero-actions');
        if (heroActions && heroActions.previousElementSibling) {
            clickableContainer = heroActions.previousElementSibling;
        }
    }
    
    if (clickableContainer) {
        clickableContainer.style.cursor = 'pointer';
        clickableContainer.style.transition = 'opacity 0.2s ease';
        
        // Remove any existing listeners to prevent duplicates
        const newContainer = clickableContainer.cloneNode(true);
        clickableContainer.parentNode?.replaceChild(newContainer, clickableContainer);
        
        newContainer.addEventListener('click', function(e) {
            // Don't navigate if clicking on the connect button or its children
            if (e.target.closest('.connect-btn')) {
                console.log('🚫 Connect button clicked, not navigating to creator channel');
                return;
            }
            
            const creatorId = window.currentContent?.creator_id;
            const creatorName = window.currentContent?.creator_display_name || 
                               window.currentContent?.creator || 
                               window.currentContent?.user_profiles?.full_name ||
                               window.currentContent?.user_profiles?.username ||
                               'Creator';
            
            if (creatorId) {
                console.log('🔗 Navigating to creator channel:', creatorId, creatorName);
                window.location.href = `creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creatorName)}`;
            } else {
                console.warn('⚠️ No creator_id available for navigation');
            }
        });
        
        // Add hover effect
        newContainer.addEventListener('mouseenter', function() {
            this.style.opacity = '0.8';
        });
        newContainer.addEventListener('mouseleave', function() {
            this.style.opacity = '1';
        });
        
        console.log('✅ Creator click navigation setup complete');
    } else {
        console.warn('⚠️ Could not find clickable container for creator navigation');
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
    if (!creatorId) {
        console.log('⚠️ checkConnectionStatus: No creatorId provided');
        return false;
    }
    
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
 * Handles both #connectBtn and #connectCreatorBtn
 */
async function setupConnectButtons() {
    const connectBtn = document.getElementById('connectBtn');
    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    const creatorId = window.currentContent?.creator_id || window.currentContent?.user_id;
    
    if (!creatorId) {
        console.log('⚠️ No creator_id available, skipping connect buttons setup');
        return;
    }
    
    console.log('🔧 Setting up connect buttons for creator:', creatorId);
    
    // Helper to update button UI
    const updateButtonUI = async (button) => {
        if (!button) return;
        const isConnected = await checkConnectionStatus(creatorId);
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
                    .eq('connected_id', creatorId);
                
                if (error) throw error;
                
                // Invalidate cache
                creatorConnectionCache.delete(creatorId);
                
                button.classList.remove('connected');
                button.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                button.setAttribute('data-connected', 'false');
                
                if (typeof window.showToast === 'function') {
                    window.showToast('Disconnected from creator', 'info');
                }
                console.log(`✅ Connection removed between ${userProfile.id} and ${creatorId}`);
            } else {
                // Check for existing connection first (prevent 409)
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
                    creatorConnectionCache.delete(creatorId);
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
                        connected_id: creatorId,
                        connection_type: 'creator',
                        created_at: new Date().toISOString()
                    });
                
                if (error) throw error;
                
                // Invalidate cache
                creatorConnectionCache.delete(creatorId);
                
                button.classList.add('connected');
                button.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                button.setAttribute('data-connected', 'true');
                
                if (typeof window.showToast === 'function') {
                    window.showToast('Connected successfully!', 'success');
                }
                console.log(`✅ Connection added between ${userProfile.id} and ${creatorId}`);
                
                // Track event if analytics available
                if (window.track?.userConnect) {
                    window.track.userConnect(creatorId);
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
    const creatorId = window.currentContent?.creator_id || window.currentContent?.user_id;
    if (!creatorId) {
        console.log('⚠️ No creator_id available for refresh');
        return;
    }
    
    // Invalidate cache
    creatorConnectionCache.delete(creatorId);
    
    const connectBtn = document.getElementById('connectBtn');
    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    
    const updateButton = async (button) => {
        if (!button) return;
        const isConnected = await checkConnectionStatus(creatorId);
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

/**
 * Initialize entire creator section
 * Call this after content is loaded
 */
async function initCreatorSection() {
    console.log('🎬 Initializing creator section...');
    
    const content = window.currentContent;
    if (!content) {
        console.warn('⚠️ No content available for creator section');
        return;
    }
    
    // Update creator avatar and name
    updateCreatorAvatar(content);
    
    const creatorName = content.creator_display_name || content.creator || 
                       content.user_profiles?.full_name || content.user_profiles?.username || 
                       (window.currentPlaylist?.creator_name || 'Creator');
    updateCreatorDisplayName(creatorName);
    
    // Setup click navigation
    setupCreatorClickNavigation();
    
    // Setup connect buttons
    await setupConnectButtons();
    
    console.log('✅ Creator section initialized');
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

// Auto-initialize when content is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait a bit for currentContent to be set
        setTimeout(() => {
            if (window.currentContent) {
                initCreatorSection();
            }
        }, 500);
    });
} else {
    setTimeout(() => {
        if (window.currentContent) {
            initCreatorSection();
        }
    }, 500);
}

// Also listen for content changes
window.addEventListener('contentIdChanged', () => {
    setTimeout(() => {
        if (window.currentContent) {
            initCreatorSection();
        }
    }, 300);
});

console.log('✅ Creator Section Module loaded (fully fixed)');
