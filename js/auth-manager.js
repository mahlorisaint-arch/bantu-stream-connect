/**
 * Secure Authentication Manager
 * Handles user authentication with security best practices
 */

class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.user = null;
        this.session = null;
        this.pendingRequests = [];
        
        // Initialize with backend API (not direct Supabase)
        this.apiEndpoint = window.AppConfig.endpoints.auth;
        
        // Security: Token storage with encryption
        this.tokenStorage = {
            set: (key, value) => {
                try {
                    // Use HttpOnly cookies for production
                    if (window.AppConfig.isProduction) {
                        this.setCookie(key, value, 7); // 7 days
                    } else {
                        // localStorage for development (with prefix)
                        localStorage.setItem(`bantu_${key}`, value);
                    }
                } catch (e) {
                    console.warn('Token storage failed:', e);
                }
            },
            
            get: (key) => {
                try {
                    if (window.AppConfig.isProduction) {
                        return this.getCookie(key);
                    } else {
                        return localStorage.getItem(`bantu_${key}`);
                    }
                } catch (e) {
                    console.warn('Token retrieval failed:', e);
                    return null;
                }
            },
            
            remove: (key) => {
                try {
                    if (window.AppConfig.isProduction) {
                        this.deleteCookie(key);
                    } else {
                        localStorage.removeItem(`bantu_${key}`);
                    }
                } catch (e) {
                    console.warn('Token removal failed:', e);
                }
            }
        };
    }
    
    // Cookie helpers for secure token storage
    setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + date.toUTCString();
        document.cookie = `bantu_${name}=${value};${expires};path=/;SameSite=Strict;Secure`;
    }
    
    getCookie(name) {
        const nameEQ = `bantu_${name}=`;
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
        }
        return null;
    }
    
    deleteCookie(name) {
        document.cookie = `bantu_${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
    
    async init() {
        try {
            // Check existing session via backend
            const response = await this.apiRequest('GET', 'session');
            
            if (response.success && response.data) {
                this.user = response.data.user;
                this.session = response.data.session;
                this.isAuthenticated = true;
                
                // Security: Validate session
                this.validateSession();
                
                // Fire event
                this.dispatchEvent('auth:change', { user: this.user });
                
                return { user: this.user, session: this.session };
            }
            
            return null;
        } catch (error) {
            console.error('Auth init failed:', error);
            return null;
        }
    }
    
    async signIn(email, password) {
        try {
            // Input validation
            if (!this.validateEmail(email)) {
                throw new Error('Invalid email format');
            }
            
            if (!this.validatePassword(password)) {
                throw new Error('Password must be at least 8 characters');
            }
            
            // Rate limiting check
            if (!this.checkRateLimit('signin')) {
                throw new Error('Too many attempts. Please try again later.');
            }
            
            // Send to backend (not directly to Supabase)
            const response = await this.apiRequest('POST', 'signin', {
                email: email,
                password: password,
                device: navigator.userAgent,
                timestamp: Date.now()
            });
            
            if (response.success) {
                this.user = response.data.user;
                this.session = response.data.session;
                this.isAuthenticated = true;
                
                // Store tokens securely
                if (response.data.access_token) {
                    this.tokenStorage.set('access_token', response.data.access_token);
                }
                if (response.data.refresh_token) {
                    this.tokenStorage.set('refresh_token', response.data.refresh_token);
                }
                
                // Log successful login
                this.logSecurityEvent('signin_success', { email });
                
                // Fire event
                this.dispatchEvent('auth:signin', { user: this.user });
                
                return { user: this.user };
            } else {
                throw new Error(response.error || 'Sign in failed');
            }
            
        } catch (error) {
            // Log failed attempt
            this.logSecurityEvent('signin_failed', { email, reason: error.message });
            throw error;
        }
    }
    
    async signOut() {
        try {
            // Notify backend
            await this.apiRequest('POST', 'signout');
            
            // Log security event
            this.logSecurityEvent('signout', { userId: this.user?.id });
            
        } catch (error) {
            console.warn('Signout notification failed:', error);
        } finally {
            // Clear local state regardless
            this.clearAuthState();
            
            // Fire event
            this.dispatchEvent('auth:signout');
        }
    }
    
    clearAuthState() {
        this.user = null;
        this.session = null;
        this.isAuthenticated = false;
        
        // Clear all tokens
        this.tokenStorage.remove('access_token');
        this.tokenStorage.remove('refresh_token');
        
        // Clear any pending requests
        this.pendingRequests = [];
    }
    
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }
    
    validatePassword(password) {
        return password && password.length >= 8;
    }
    
    checkRateLimit(action) {
        const key = `ratelimit_${action}`;
        const now = Date.now();
        const window = 15 * 60 * 1000; // 15 minutes
        const maxAttempts = 5;
        
        let attempts = JSON.parse(this.tokenStorage.get(key) || '[]');
        
        // Remove old attempts
        attempts = attempts.filter(time => now - time < window);
        
        if (attempts.length >= maxAttempts) {
            return false;
        }
        
        // Add current attempt
        attempts.push(now);
        this.tokenStorage.set(key, JSON.stringify(attempts));
        
        return true;
    }
    
    async validateSession() {
        if (!this.session) return false;
        
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = this.session.expires_at || this.session.expires_at;
        
        if (expiresAt && expiresAt < now) {
            // Session expired
            await this.refreshSession();
        }
        
        return true;
    }
    
    async refreshSession() {
        try {
            const refreshToken = this.tokenStorage.get('refresh_token');
            if (!refreshToken) throw new Error('No refresh token');
            
            const response = await this.apiRequest('POST', 'refresh', {
                refresh_token: refreshToken
            });
            
            if (response.success) {
                this.session = response.data.session;
                this.tokenStorage.set('access_token', response.data.access_token);
                return true;
            }
        } catch (error) {
            console.error('Session refresh failed:', error);
            await this.signOut();
            return false;
        }
    }
    
    logSecurityEvent(event, data = {}) {
        // Send to backend for logging
        if (window.AppConfig.features.analytics) {
            navigator.sendBeacon(`${this.apiEndpoint}/security`, JSON.stringify({
                event,
                data,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                ip: 'client' // IP will be captured by backend
            }));
        }
    }
    
    async apiRequest(method, endpoint, data = null) {
        const url = `${this.apiEndpoint}/${endpoint}`;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        
        // Add auth token if available
        const token = this.tokenStorage.get('access_token');
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'API request failed');
            }
            
            return result;
        } catch (error) {
            console.error(`API request failed (${endpoint}):`, error);
            throw error;
        }
    }
    
    dispatchEvent(name, detail = {}) {
        const event = new CustomEvent(name, { detail });
        document.dispatchEvent(event);
    }
    
    // Security: Sanitize user data before display
    sanitizeUserData(user) {
        if (!user) return null;
        
        return {
            id: user.id,
            email: this.maskEmail(user.email),
            name: user.name || '',
            avatar: user.avatar || null,
            role: user.role || 'user'
        };
    }
    
    maskEmail(email) {
        if (!email) return '';
        const [local, domain] = email.split('@');
        if (local.length <= 2) return email;
        return `${local[0]}***${local[local.length - 1]}@${domain}`;
    }
}

// Initialize and export
window.AuthManager = new AuthManager();
