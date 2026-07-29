// js/supabase-client-init.js
// Creates window.supabaseClient as its own deferred script, positioned
// right after the Supabase SDK CDN script and before every other local
// script that depends on it (shared-components.js, supabase-helper.js,
// etc.). Deferred scripts execute in document order before
// DOMContentLoaded fires - unlike a DOMContentLoaded listener, which
// would run too late, after scripts like shared-components.js that call
// window.supabaseClient.auth.onAuthStateChange() at their own top level
// during that same deferred-execution phase.
window.SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
console.log('✅ Supabase client initialized');
