// Shorts Phase 2 (Part B §3-4, Part F, Part G) - the canonical public
// Short landing page: https://bantustreamconnect.com/shorts/{id}.
//
// This exists as a Cloudflare Pages Function (not a static HTML file)
// specifically because Part G/§21 requires REAL per-Short Open Graph
// metadata (og:title/og:image/etc pointing at the actual Short a link
// preview bot is unfurling) - a static page can't do that, since
// WhatsApp/X/Discord/Facebook's preview crawlers don't execute
// client-side JavaScript. This function fetches the one Short's real
// public data server-side and renders it directly into the HTML head
// before any bot or browser sees it - the minimal-architecture answer
// Part G explicitly names ("Pages Function"), not a new backend
// framework.
//
// This is deliberately a lightweight LANDING page, not the full
// interactive Shorts feed (comments/notifications/search/etc) that
// already lives at shorts-detail.html - that page is untouched and
// keeps working exactly as before for every link already shared before
// this phase (Part C §3/§28). This new page's whole job is: show what
// the link actually is, and get the visitor into the real app (or the
// store) as fast as possible.
//
// Content visibility here matches the app's own real RLS policy exactly
// (content_select_authorized: status = 'published' OR own row) - this
// function has no user session, so it only ever sees published rows,
// same as any other anonymous visitor (Part K §29/Part L §32 - never
// exposes unavailable media just because someone has a link). Live-
// verified directly against production data and RLS (2026-09-18): a
// draft-status row returns 406/not-found through this exact query, the
// same as a genuinely nonexistent id.
//
// Phase 2.1 (§5) security note: every creator/content-derived string
// below (title, creator name, description, thumbnail URL) goes through
// escapeHtml() at EVERY insertion point - the visible HTML, the <title>,
// and every Open Graph/Twitter meta attribute. Re-audited 2026-09-18,
// confirmed no unescaped interpolation of any of those four fields
// anywhere in renderPage(). FALLBACK_IMAGE/APP_STORE_URL/PLAY_STORE_URL
// are hardcoded constants, not user input, so they're used directly.

const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

const APP_STORE_URL = 'https://apps.apple.com/us/app/bantu-stream-connect/id6797660273';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.bsc.app';
const ANDROID_PACKAGE = 'com.bsc.app';
const FALLBACK_IMAGE = 'https://bantustreamconnect.com/assets/bsc-logo.png';

// Shorts Phase 2.1 (§5) - the one escaping helper, used for every single
// creator/content-derived string inserted into this page, in BOTH the
// visible HTML and the Open Graph/Twitter <meta> attributes. Escaping
// all five HTML-significant characters is safe for both a text node and
// a double-quoted attribute value, so one function correctly covers
// every insertion point in this file - there is no second "attribute
// escaping" helper to forget to use.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Shorts Phase 2.1 (§3/§4) - reuses the exact same app_events table
// Flutter's AnalyticsService already writes to (confirmed live: RLS's
// app_events_insert policy already grants anon+authenticated INSERT with
// no restriction), instead of building a second, separate web analytics
// pipeline. Fire-and-forget - handed to context.waitUntil() by the
// caller so it never delays the actual page response, and a failure
// here must never break the landing page itself.
async function logAppEvent(eventType) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_events`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ event_type: eventType, platform: 'web' }),
    });
  } catch {
    // Best-effort - never worth failing the page render over.
  }
}

async function fetchShort(id) {
  const url =
    `${SUPABASE_URL}/rest/v1/Content` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=id,title,description,thumbnail_url,status,user_id,user_profiles!user_id(username,full_name)`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/vnd.pgrst.object+json',
    },
  });
  // PostgREST returns 406 for maybeSingle-style "no row" with the
  // vnd.pgrst.object+json header - not a real error, just "not found"
  // (also what a draft/unpublished row looks like to this anon-key
  // query, since RLS hides it entirely rather than returning it with a
  // non-published status - live-verified, see the file's top comment).
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function renderPage({ short, canonicalUrl }) {
  const found = short && short.status === 'published';
  const title = found ? short.title || 'A Short on Bantu Stream Connect' : 'Short not found';
  const creatorName = found ? short.user_profiles?.full_name || short.user_profiles?.username || 'a BSC creator' : null;
  const description = found
    ? (short.description && short.description.trim()) || `Watch "${short.title || 'this Short'}" by ${creatorName} on Bantu Stream Connect.`
    : 'This Short is unavailable - it may have been removed, or the link may be incorrect.';
  const image = (found && short.thumbnail_url) || FALLBACK_IMAGE;

  // Android intent:// fallback (Part F §17) - a plain <a href="https://...">
  // tap from WITHIN a browser tab (as opposed to a tap arriving from
  // WhatsApp/Instagram/etc that hands off before a browser ever opens)
  // is not reliably re-intercepted as an App Link by every browser once
  // already on bantustreamconnect.com. The intent:// scheme explicitly
  // asks Android to launch the verified app for this exact URL and only
  // falls back to Google Play if it truly isn't installed - iOS has no
  // equivalent construct, so iOS relies on the plain https link plus a
  // real Universal Link tap (share-surface taps, not same-page taps,
  // are the common real case anyway).
  const androidIntentUrl = `intent://${canonicalUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;

  const body = found
    ? `
      <div class="thumb-wrap">
        <img class="thumb" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" />
        <div class="play-badge">&#9654;</div>
      </div>
      <h1>${escapeHtml(title)}</h1>
      <p class="creator">by ${escapeHtml(creatorName)}</p>
      <p class="caption">${escapeHtml(description)}</p>
    `
    : `
      <div class="thumb-wrap thumb-wrap--empty">
        <img class="thumb" src="${FALLBACK_IMAGE}" alt="Bantu Stream Connect" />
      </div>
      <h1>Short not found</h1>
      <p class="caption">${escapeHtml(description)}</p>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0A0E12">
<title>${escapeHtml(title)} - Bantu Stream Connect</title>
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
<link rel="icon" type="image/x-icon" href="/assets/favicon/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon/apple-touch-icon.png">

<!-- Open Graph / link-preview metadata (Part G §20) - real per-Short
     values, computed server-side above, so WhatsApp/Facebook/X/Discord
     previews show the actual Short, not generic site boilerplate. Every
     value here is escapeHtml()'d - see this file's top comment (§5). -->
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="Bantu Stream Connect">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">

<!-- Universal Links (iOS) / App Links (Android) claim this exact path
     directly via apple-app-site-association / assetlinks.json - when the
     app is installed and verified, the OS opens it before this page ever
     renders for most real share-surface taps (WhatsApp/Instagram/etc).
     This page is what non-installed users, and same-tab taps on some
     browsers, actually see. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Orbitron:wght@600;700&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; background: #0A0E12; color: #E8ECF1;
    font-family: 'Inter', -apple-system, sans-serif;
    display: flex; flex-direction: column; align-items: center;
    padding: 28px 20px 40px; text-align: center;
  }
  .logo { width: 40px; height: 40px; border-radius: 10px; margin-bottom: 18px; }
  .thumb-wrap {
    position: relative; width: min(240px, 60vw); aspect-ratio: 9 / 16;
    border-radius: 18px; overflow: hidden; margin: 8px 0 20px;
    border: 1px solid rgba(0, 229, 255, 0.35);
    box-shadow: 0 0 28px rgba(0, 229, 255, 0.18);
    background: #10161C;
  }
  .thumb-wrap--empty { aspect-ratio: 1 / 1; width: 96px; }
  .thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
  .play-badge {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 15px; color: #0A0E12; background: rgba(0, 229, 255, 0.9);
    width: 40px; height: 40px; border-radius: 999px; margin: auto;
    box-shadow: 0 0 16px rgba(0, 229, 255, 0.6);
  }
  h1 { font-family: 'Orbitron', sans-serif; font-size: 19px; line-height: 1.35; margin: 0 0 6px; max-width: 380px; }
  .creator { color: #00E5FF; font-weight: 600; font-size: 14px; margin: 0 0 10px; }
  .caption { color: #94A3B8; font-size: 14px; max-width: 380px; margin: 0 0 26px; line-height: 1.5; }
  .open-btn {
    display: block; width: min(340px, 100%); padding: 15px 20px; margin-bottom: 12px;
    background: #00E5FF; color: #0A0E12; font-weight: 700; font-size: 15px;
    text-decoration: none; border-radius: 999px; border: none;
  }
  .store-row { display: flex; flex-direction: column; gap: 10px; width: min(340px, 100%); margin-top: 6px; }
  .store-link {
    display: block; padding: 13px 18px; border-radius: 12px; border: 1px solid rgba(0, 229, 255, 0.3);
    color: #E8ECF1; text-decoration: none; font-weight: 600; font-size: 14px;
  }
  .brand-footer { margin-top: 34px; color: #4B5768; font-size: 11px; letter-spacing: 0.4px; }
</style>
</head>
<body>
  <img class="logo" src="/assets/icon/bantu_stream_connect_icon.png" alt="Bantu Stream Connect">
  ${body}
  <a class="open-btn" id="open-app-btn" href="${escapeHtml(canonicalUrl)}">Open in BSC</a>
  <div class="store-row">
    <a class="store-link" id="app-store-link" href="${APP_STORE_URL}">Download on the App Store</a>
    <a class="store-link" id="play-store-link" href="${PLAY_STORE_URL}">Get it on Google Play</a>
  </div>
  <div class="brand-footer">BANTU STREAM CONNECT &middot; NO DNA. JUST RSA.</div>
  <script>
    // Shorts Phase 2.1 (§3/§4) - client-side acquisition taps. Posts
    // directly to the same app_events table the Function itself (and
    // the Flutter app) already uses - no separate web analytics
    // pipeline, no PII (no content id, no URL, no referrer). keepalive
    // ensures the request survives the page navigating away immediately
    // after the tap (the whole point of the click).
    function logWebEvent(eventType) {
      try {
        fetch(${JSON.stringify(`${SUPABASE_URL}/rest/v1/app_events`)}, {
          method: 'POST',
          headers: {
            apikey: ${JSON.stringify(SUPABASE_ANON_KEY)},
            Authorization: ${JSON.stringify(`Bearer ${SUPABASE_ANON_KEY}`)},
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ event_type: eventType, platform: 'web' }),
          keepalive: true,
        }).catch(function () {});
      } catch (e) {}
    }

    // Part F §17 - prefer the real Universal/App Link (canonicalUrl) as
    // the href by default (so "Open in new tab"/long-press/share still
    // gets a real, correct URL); on Android specifically, upgrade the
    // click itself to the intent:// form, which the OS honors more
    // reliably as an explicit "launch this exact app" request than a
    // same-tab https anchor tap.
    (function () {
      var isAndroid = /Android/i.test(navigator.userAgent);
      var btn = document.getElementById('open-app-btn');
      if (btn) {
        btn.addEventListener('click', function (e) {
          logWebEvent('short_open_app_tap');
          if (!isAndroid) return;
          e.preventDefault();
          window.location.href = ${JSON.stringify(androidIntentUrl)};
        });
      }
      var appStoreLink = document.getElementById('app-store-link');
      if (appStoreLink) appStoreLink.addEventListener('click', function () { logWebEvent('short_install_cta_tap'); });
      var playStoreLink = document.getElementById('play-store-link');
      if (playStoreLink) playStoreLink.addEventListener('click', function () { logWebEvent('short_install_cta_tap'); });
    })();
  </script>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { params, request, waitUntil } = context;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = Number.parseInt(rawId, 10);
  const canonicalUrl = new URL(`/shorts/${Number.isFinite(id) && id > 0 ? id : rawId}`, request.url).toString();

  const short = Number.isFinite(id) && id > 0 ? await fetchShort(id) : null;
  const found = Boolean(short && short.status === 'published');

  // Shorts Phase 2.1 (§3/§4) - fire-and-forget via waitUntil so this
  // never delays the actual page response the visitor/bot is waiting on.
  waitUntil(logAppEvent('short_web_landing'));

  // Shorts Phase 2.1 (§7) - cache behavior. A found+published Short gets
  // a short public cache (2 min browser, 5 min Cloudflare edge) so a
  // burst of link-preview crawlers/repeat visitors doesn't hammer
  // Supabase for the same id, while staying short enough that an
  // unpublish/delete/report-takedown is reflected within minutes, not
  // hours - not the long-lived (day/week) caching a purely static asset
  // would get. A not-found/invalid response is explicitly never cached
  // at all (no-store) - both because a 404 has no useful content to
  // cache, and so a Short that gets deleted/unpublished right after a
  // brief window where it WAS cached as "found" doesn't leave that
  // stale cached copy any way to un-cache itself early.
  const cacheControl = found ? 'public, max-age=120, s-maxage=300' : 'no-store';

  return new Response(renderPage({ short, canonicalUrl }), {
    status: found ? 200 : 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cacheControl },
  });
}
