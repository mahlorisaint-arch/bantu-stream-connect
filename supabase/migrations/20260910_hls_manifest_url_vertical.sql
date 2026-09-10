-- Applied live via Supabase MCP. Record only.
--
-- Enables old-app-version compatibility for long vertical video sizing:
-- the currently-published app can only ever read hls_manifest_url (it was
-- compiled with that field name, no way to teach it about a new one). So
-- for long (>60s) vertical video, the transcoder now produces two outputs
-- and this new field holds the true native-vertical one - only new
-- app/web code is taught to prefer it. hls_manifest_url becomes a
-- 16:9-letterboxed compatibility stream for that same content, so the
-- already-installed app keeps working, unmodified, and gets a properly
-- full-width video instead of a tiny shrunk one - no update required.
-- See transcoder/index.js's processVideo/transcodeLetterboxedRendition.

alter table public."Content" add column if not exists hls_manifest_url_vertical text;
