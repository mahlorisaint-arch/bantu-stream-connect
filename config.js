window.SUPABASE_CONFIG = {
    URL: 'https://ydnxqnbjoshvxteevemc.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
};

// Validate configuration
if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.URL || !window.SUPABASE_CONFIG.ANON_KEY) {
    console.error('Missing Supabase configuration');
}
