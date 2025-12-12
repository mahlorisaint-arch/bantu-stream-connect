// auth.js - Centralized Authentication System for Bantu Stream Connect

class AuthManager {
    constructor() {
        this.supabaseUrl = 'https://ydnxqnbjoshvxteevemc.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
        this.storageKey = 'bantu_stream_connect_session';
        this.currentUser = null;
        this.userProfile = null;
    }

    // Initialize authentication
    async initialize() {
        try {
            // Check for stored session
            const session = localStorage.getItem(this.storageKey);
            if (session) {
                const sessionData = JSON.parse(session);
                this.currentUser = sessionData.user;
                this.userProfile = sessionData.profile;
                
                // Check if session is expired
                if (sessionData.expires_at < Date.now() / 1000) {
                    console.log('Session expired, logging out');
                    await this.logout();
                    return false;
                }
                
                return true;
            }
            return false;
        } catch (error) {
            console.error('Auth initialization error:', error);
            return false;
        }
    }

    // Simple Supabase REST client for auth
    async signInWithEmail(email, password) {
        try {
            const response = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': this.supabaseKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Invalid email or password');
            }

            const result = await response.json();
            this.currentUser = result.user;
            
            // Get user profile
            this.userProfile = await this.getUserProfile(result.user.id);
            
            // Store session
            this.storeSession(result);
            
            return { user: result.user, profile: this.userProfile };
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    }

    async signUp(email, password, userData = {}) {
        try {
            const response = await fetch(`${this.supabaseUrl}/auth/v1/signup`, {
                method: 'POST',
                headers: {
                    'apikey': this.supabaseKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email, 
                    password,
                    data: userData 
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Sign up failed');
            }

            const result = await response.json();
            this.currentUser = result.user;
            
            // Create user profile
            this.userProfile = await this.createUserProfile(result.user.id, userData);
            
            // Store session
            this.storeSession(result);
            
            return { user: result.user, profile: this.userProfile };
        } catch (error) {
            console.error('Sign up error:', error);
            throw error;
        }
    }

    async getUserProfile(userId) {
        try {
            const response = await fetch(
                `${this.supabaseUrl}/rest/v1/user_profiles?user_id=eq.${userId}&select=*`,
                {
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const profiles = await response.json();
                return profiles.length > 0 ? profiles[0] : null;
            }
            return null;
        } catch (error) {
            console.error('Get user profile error:', error);
            return null;
        }
    }

    async createUserProfile(userId, userData) {
        try {
            const profileData = {
                user_id: userId,
                full_name: userData.full_name || '',
                username: userData.username || `user_${userId.substring(0, 8)}`,
                role: userData.role || 'viewer',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const response = await fetch(`${this.supabaseUrl}/rest/v1/user_profiles`, {
                method: 'POST',
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(profileData)
            });

            if (response.ok) {
                const result = await response.json();
                return result[0];
            }
            return null;
        } catch (error) {
            console.error('Create user profile error:', error);
            return null;
        }
    }

    storeSession(authResult) {
        const sessionData = {
            user: authResult.user,
            profile: this.userProfile,
            access_token: authResult.access_token,
            refresh_token: authResult.refresh_token,
            expires_at: authResult.expires_at || Math.floor(Date.now() / 1000) + 3600,
            expires_in: authResult.expires_in || 3600
        };
        
        localStorage.setItem(this.storageKey, JSON.stringify(sessionData));
    }

    async logout() {
        localStorage.removeItem(this.storageKey);
        this.currentUser = null;
        this.userProfile = null;
        
        // Redirect to login page
        window.location.href = 'login.html';
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getUserProfile() {
        return this.userProfile;
    }

    async updateProfile(data) {
        try {
            if (!this.currentUser) return null;

            const response = await fetch(
                `${this.supabaseUrl}/rest/v1/user_profiles?user_id=eq.${this.currentUser.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        ...data,
                        updated_at: new Date().toISOString()
                    })
                }
            );

            if (response.ok) {
                const result = await response.json();
                this.userProfile = result[0];
                
                // Update stored session
                const session = localStorage.getItem(this.storageKey);
                if (session) {
                    const sessionData = JSON.parse(session);
                    sessionData.profile = this.userProfile;
                    localStorage.setItem(this.storageKey, JSON.stringify(sessionData));
                }
                
                return this.userProfile;
            }
            return null;
        } catch (error) {
            console.error('Update profile error:', error);
            throw error;
        }
    }

    async resetPassword(email) {
        try {
            const response = await fetch(`${this.supabaseUrl}/auth/v1/recover`, {
                method: 'POST',
                headers: {
                    'apikey': this.supabaseKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Password reset failed');
            }

            return true;
        } catch (error) {
            console.error('Reset password error:', error);
            throw error;
        }
    }

    // Get session from URL parameters (for OAuth redirects)
    async handleAuthRedirect() {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            const params = new URLSearchParams(hash.substring(1));
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            
            if (access_token) {
                // Get user info
                const userResponse = await fetch(`${this.supabaseUrl}/auth/v1/user`, {
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${access_token}`
                    }
                });
                
                if (userResponse.ok) {
                    const user = await userResponse.json();
                    this.currentUser = user;
                    this.userProfile = await this.getUserProfile(user.id);
                    
                    const authResult = {
                        user,
                        access_token,
                        refresh_token,
                        expires_at: Math.floor(Date.now() / 1000) + 3600,
                        expires_in: 3600
                    };
                    
                    this.storeSession(authResult);
                    
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    return true;
                }
            }
        }
        return false;
    }
}

// Create global auth instance
window.AuthManager = AuthManager;
window.auth = new AuthManager();

console.log('✅ Auth Manager initialized');
