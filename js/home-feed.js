// ============================================
// HOME FEED - BOOTSTRAP MODULE
// ============================================
// This file now only handles Supabase initialization
// and module bootstrapping. All feature code is migrated.
// ============================================

// Supabase Configuration
const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Initialize Supabase client
const supabaseAuth = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Make available globally
if (typeof window !== 'undefined') {
    window.supabaseAuth = supabaseAuth;
    window.SUPABASE_URL = SUPABASE_URL;
    window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
}

console.log('✅ Supabase client initialized');

// Simple media URL helpers
function fixMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanPath = url.replace(/^\/+/, '');
    return `${SUPABASE_URL}/storage/v1/object/public/content/${cleanPath}`;
}

function fixAvatarUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanPath = url.replace(/^\/+/, '').replace(/^avatars\//, '');
    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${cleanPath}`;
}

// Export to window
if (typeof window !== 'undefined') {
    window.fixMediaUrl = fixMediaUrl;
    window.fixAvatarUrl = fixAvatarUrl;
}

console.log('✅ Home feed bootstrap ready - Modules will auto-initialize');
