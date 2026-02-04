console.log('🔐 Auth Helper Initializing...');

const AuthHelper = {
    isInitialized: false,
    currentUser: null,
    userProfile: null,
    
    // Initialize auth helper
    initialize: async function() {
        try {
            if (!window.SupabaseHelper || !window.SupabaseHelper.initialize) {
                console.warn('⚠️ SupabaseHelper not available');
                return false;
            }
            
            // Initialize SupabaseHelper if needed
            if (!window.SupabaseHelper.isInitialized) {
                await window.SupabaseHelper.initialize();
            }
            
            // Get current user
            this.currentUser = await window.SupabaseHelper.getCurrentUser();
            
            if (this.currentUser) {
                // Get user profile data
                await this.loadUserProfile();
                console.log('✅ User authenticated:', this.currentUser.email);
            } else {
                console.log('⚠️ No authenticated user');
            }
            
            this.isInitialized = true;
            
            // Dispatch custom event when auth is ready
            const event = new CustomEvent('authReady', { 
                detail: { 
                    isAuthenticated: this.isAuthenticated(),
                    userProfile: this.userProfile 
                } 
            });
            document.dispatchEvent(event);
            
            return true;
        } catch (error) {
            console.error('❌ Auth Helper Initialization error:', error);
            return false;
        }
    },
    
    // Load user profile from database
    loadUserProfile: async function() {
        if (!this.currentUser || !window.SupabaseHelper.client) {
            return null;
        }
        
        try {
            const { data, error } = await window.SupabaseHelper.client
                .from('user_profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();
            
            if (error) {
                console.warn('⚠️ No user profile found, using auth metadata');
                // Create a basic profile from auth data
                this.userProfile = {
                    id: this.currentUser.id,
                    email: this.currentUser.email,
                    full_name: this.currentUser.user_metadata?.full_name || 
                               this.currentUser.email?.split('@')[0] || 'User',
                    username: this.currentUser.user_metadata?.username || 
                             this.currentUser.email?.split('@')[0] || 'user',
                    avatar_url: this.currentUser.user_metadata?.avatar_url || null,
                    role: this.currentUser.user_metadata?.role || 'user'
                };
            } else {
                this.userProfile = data;
                console.log('✅ User profile loaded:', this.userProfile.username);
            }
            
            return this.userProfile;
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
            return null;
        }
    },
    
    // Get current user info
    getCurrentUser: function() {
        return this.currentUser;
    },
    
    // Get user profile
    getUserProfile: function() {
        return this.userProfile;
    },
    
    // Check if user is authenticated
    isAuthenticated: function() {
        return !!this.currentUser;
    },
    
    // Get display name (full name or username)
    getDisplayName: function() {
        if (!this.userProfile) return 'User';
        
        return this.userProfile.full_name || 
               this.userProfile.username || 
               this.userProfile.email?.split('@')[0] || 
               'User';
    },
    
    // Get username
    getUsername: function() {
        if (!this.userProfile) return 'user';
        
        return this.userProfile.username || 
               this.userProfile.email?.split('@')[0] || 
               'user';
    },
    
    // Get avatar URL
    getAvatarUrl: function() {
        if (!this.userProfile || !this.userProfile.avatar_url) {
            return null;
        }
        
        // Fix the avatar URL if needed
        if (this.userProfile.avatar_url.startsWith('http')) {
            return this.userProfile.avatar_url;
        }
        
        // Construct full URL for Supabase storage
        return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/profile-pictures/${this.userProfile.avatar_url}`;
    },
    
    // Sign out
    signOut: async function() {
        try {
            if (!window.SupabaseHelper || !window.SupabaseHelper.client) {
                return false;
            }
            
            const { error } = await window.SupabaseHelper.client.auth.signOut();
            if (error) throw error;
            
            this.currentUser = null;
            this.userProfile = null;
            console.log('✅ User signed out successfully');
            return true;
        } catch (error) {
            console.error('❌ Sign out error:', error);
            return false;
        }
    },
    
    // Redirect to login page
    redirectToLogin: function(redirectUrl = null) {
        const url = redirectUrl || window.location.href;
        window.location.href = `login.html?redirect=${encodeURIComponent(url)}`;
    },
    
    // Check and handle authentication for actions
    requireAuth: async function(actionName = 'perform this action') {
        if (!this.isAuthenticated()) {
            const login = confirm(`You need to sign in to ${actionName}. Would you like to sign in now?`);
            if (login) {
                this.redirectToLogin();
            }
            return false;
        }
        return true;
    }
};

// Initialize immediately
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing auth helper');
    AuthHelper.initialize().then(() => {
        console.log('Auth helper initialized');
    });
});

// Make available globally
window.AuthHelper = AuthHelper;
