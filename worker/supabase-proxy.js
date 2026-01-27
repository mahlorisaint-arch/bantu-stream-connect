// worker/supabase-proxy.js
// This runs on Cloudflare for FREE and hides your Supabase key

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Your Supabase URL and key - these are SAFE here (not visible to users)
  const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co'
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
  
  const url = new URL(request.url)
  
  // Only allow certain endpoints for security
  const allowedPaths = ['/rest/v1/Content', '/rest/v1/content', '/rest/v1/user_profiles']
  
  if (!allowedPaths.some(path => url.pathname.startsWith(path))) {
    return new Response('Not Found', { status: 404 })
  }
  
  // Forward request to Supabase
  const supabaseUrl = SUPABASE_URL + url.pathname + url.search
  
  const modifiedRequest = new Request(supabaseUrl, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    method: request.method,
    body: request.body
  })
  
  const response = await fetch(modifiedRequest)
  
  // Add CORS headers
  const corsResponse = new Response(response.body, response)
  corsResponse.headers.set('Access-Control-Allow-Origin', '*')
  corsResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  corsResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey')
  
  return corsResponse
}
