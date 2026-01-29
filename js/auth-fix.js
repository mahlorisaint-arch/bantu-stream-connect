// Auth Fix for Cross-Device Authentication
// ==========================================================================

// Initialize Supabase with better auth settings
window.supabaseClient = supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storage: localStorage,
            storageKey: 'bantu-auth'
        }
    }
);

// Force authentication check
async function forceAuthCheck() {
    console.log('🔐 Force checking authentication...');
    
    try {
        // Get current session
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Auth error:', error);
            localStorage.removeItem('bantu-auth');
            return null;
        }
        
        if (session) {
            console.log('✅ Session found for:', session.user.email);
            
            // Store user info in localStorage for cross-device access
            localStorage.setItem('bantu-user-email', session.user.email);
            localStorage.setItem('bantu-user-id', session.user.id);
            
            // Create or update user profile
            await ensureUserProfile(session.user);
            
            return session.user;
        }
        
        console.log('⚠️ No active session found');
        return null;
        
    } catch (error) {
        console.error('Auth check failed:', error);
        return null;
    }
}

// Ensure user profile exists
async function ensureUserProfile(user) {
    try {
        const { data: existingProfile, error: checkError } = await window.supabaseClient
            .from('user_profiles')
            .select('id')
            .eq('id', user.id)
            .single();
        
        if (checkError || !existingProfile) {
            // Create profile if it doesn't exist
            const { error: createError } = await window.supabaseClient
                .from('user_profiles')
                .upsert({
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || user.email.split('@')[0],
                    username: user.user_metadata?.user_name || user.email.split('@')[0].toLowerCase(),
                    role: 'creator',
                    created_at: new Date().toISOString()
                });
            
            if (!createError) {
                console.log('✅ User profile created/updated');
            }
        }
    } catch (error) {
        console.log('Profile check skipped:', error);
    }
}

// Check for URL tokens (OAuth redirect)
async function checkUrlTokens() {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    
    if (accessToken && refreshToken) {
        console.log('🔄 Processing OAuth redirect...');
        
        try {
            const { data: { session }, error } = await window.supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });
            
            if (!error && session) {
                console.log('✅ OAuth session set');
                
                // Remove tokens from URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                return session.user;
            }
        } catch (error) {
            console.error('OAuth processing failed:', error);
        }
    }
    
    return null;
}

// Setup auth state listener
function setupAuthListener() {
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session?.user) {
                // Update global user state
                window.currentUser = session.user;
                
                // Update UI
                updateProfileUI(session.user);
                
                // Show welcome message
                if (event === 'SIGNED_IN') {
                    showToast(`Welcome, ${session.user.email}!`, 'success');
                }
            }
        } else if (event === 'SIGNED_OUT') {
            window.currentUser = null;
            localStorage.removeItem('bantu-user-email');
            localStorage.removeItem('bantu-user-id');
            resetProfileUI();
        }
    });
}

// Update profile UI
function updateProfileUI(user) {
    const profileBtn = document.getElementById('profile-btn');
    if (!profileBtn) return;
    
    const initials = getInitials(user.email);
    profileBtn.innerHTML = `
        <div class="profile-placeholder">
            ${initials}
        </div>
    `;
    
    profileBtn.onclick = () => {
        window.location.href = 'profile.html';
    };
}

// Reset profile UI
function resetProfileUI() {
    const profileBtn = document.getElementById('profile-btn');
    if (!profileBtn) return;
    
    profileBtn.innerHTML = `
        <div class="profile-placeholder">
            <i class="fas fa-user"></i>
        </div>
    `;
    
    profileBtn.onclick = () => {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    };
}

// Get initials from email
function getInitials(email) {
    if (!email) return 'U';
    const parts = email.split('@')[0];
    return parts.substring(0, 2).toUpperCase();
}

// Show toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    
    const container = document.getElementById('toast-container') || document.createElement('div');
    if (!container.id) {
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Initialize auth when page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing authentication...');
    
    // Setup listener first
    setupAuthListener();
    
    // Check URL for OAuth tokens
    await checkUrlTokens();
    
    // Force auth check
    const user = await forceAuthCheck();
    
    if (user) {
        window.currentUser = user;
        updateProfileUI(user);
        console.log('✅ Authentication complete');
    } else {
        resetProfileUI();
        console.log('👤 No user authenticated');
    }
});

// Export for debugging
window.refreshAuth = forceAuthCheck;
window.getCurrentUser = () => window.currentUser;
