// env.js - Environment variables for secure configuration
window.ENV = {
  // These will be replaced by build process or remain as fallbacks
  SUPABASE_URL: 'https://ydnxqnbjoshvxteevemc.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
};

// Log warning about using fallback credentials in production
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  console.log('✅ Environment variables loaded');
}
