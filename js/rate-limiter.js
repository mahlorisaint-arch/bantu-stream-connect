/**
 * Rate Limiting Module
 * Prevents API abuse with request throttling
 */

class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 100; // Max requests per window
    this.windowMs = options.windowMs || 60000; // Window size in ms (default 1 minute)
    this.requests = new Map(); // Store request timestamps by endpoint + user
    this.blocked = new Map(); // Store blocked IPs/users
  }
  
  // Generate key for rate limiting (user ID + endpoint)
  getKey(userId, endpoint) {
    return `${userId || 'anonymous'}:${endpoint}`;
  }
  
  // Check if request is allowed
  checkLimit(userId, endpoint) {
    const key = this.getKey(userId, endpoint);
    const now = Date.now();
    
    // Check if blocked
    if (this.blocked.has(key)) {
      const blockExpiry = this.blocked.get(key);
      if (now < blockExpiry) {
        return { allowed: false, retryAfter: Math.ceil((blockExpiry - now) / 1000) };
      } else {
        this.blocked.delete(key);
      }
    }
    
    // Get existing requests for this key
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const timestamps = this.requests.get(key);
    
    // Remove timestamps outside current window
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);
    this.requests.set(key, validTimestamps);
    
    // Check if under limit
    if (validTimestamps.length < this.maxRequests) {
      validTimestamps.push(now);
      return { allowed: true };
    } else {
      // Block for 2x window time
      this.blocked.set(key, now + (this.windowMs * 2));
      return { allowed: false, retryAfter: Math.ceil((this.windowMs * 2) / 1000) };
    }
  }
  
  // Middleware for Supabase requests
  async wrapSupabaseRequest(userId, endpoint, requestFn) {
    const check = this.checkLimit(userId, endpoint);
    
    if (!check.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${check.retryAfter} seconds.`);
    }
    
    try {
      return await requestFn();
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }
  
  // Clear old data periodically
  startCleanup(intervalMs = 300000) { // Default 5 minutes
    setInterval(() => {
      const now = Date.now();
      
      // Clean requests
      for (const [key, timestamps] of this.requests.entries()) {
        const validTimestamps = timestamps.filter(t => now - t < this.windowMs);
        if (validTimestamps.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, validTimestamps);
        }
      }
      
      // Clean blocks
      for (const [key, expiry] of this.blocked.entries()) {
        if (now >= expiry) {
          this.blocked.delete(key);
        }
      }
    }, intervalMs);
  }
}

// Create global instances
window.rateLimiter = new RateLimiter({
  maxRequests: 50, // Stricter limit for anonymous
  windowMs: 60000 // 1 minute
});

window.authRateLimiter = new RateLimiter({
  maxRequests: 200, // Higher limit for authenticated users
  windowMs: 60000 // 1 minute
});

console.log('✅ Rate limiter initialized');
