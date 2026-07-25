// js/shared/preview-clips.js — shared hover-preview-clip system
// Extracted from js/film/movies.js so both Movies and the Home feed can
// use the exact same logic instead of duplicating it. Also adds the
// autoplay_previews Settings gate that movies.js never actually checked.
(function() {
  'use strict';

  const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';

  const HOVER_DELAY = 500;
  const hoverTimers = new WeakMap();

  // Resolved once, cached, shared by every card on the page. Matches
  // settings.js's own `profile.autoplay_previews || false` convention —
  // off unless the signed-in user's profile explicitly has it enabled.
  let autoplayPreviewsPromise = null;
  function getAutoplayPreviewsEnabled() {
    if (autoplayPreviewsPromise) return autoplayPreviewsPromise;
    autoplayPreviewsPromise = (async () => {
      try {
        const client = window.supabaseClient || window.supabaseAuth;
        const userId = window.currentUser?.id || window.currentUserId;
        if (!client || !userId) return false;
        const { data, error } = await client
          .from('user_profiles')
          .select('autoplay_previews')
          .eq('id', userId)
          .maybeSingle();
        if (error || !data) return false;
        return data.autoplay_previews || false;
      } catch (e) {
        console.warn('preview-clips: could not resolve autoplay_previews setting', e);
        return false;
      }
    })();
    return autoplayPreviewsPromise;
  }

  function fixMediaUrl(url) {
    if (!url) return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=225&fit=crop';
    if (typeof url !== 'string') return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=225&fit=crop';
    url = url.trim().replace(/^`+|`+$/g, '').replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
    if (url.startsWith('http')) return url;
    return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
  }

  function getCloudflareThumbnailUrl(providerVideoId, height = 720) {
    if (!providerVideoId) return '';
    return `https://videodelivery.net/${providerVideoId}/thumbnails/thumbnail.jpg?time=5s&height=${height}`;
  }

  function getPreviewUrl(item) {
    if (!item) return '';
    if (item.preview_clip_url) return fixMediaUrl(item.preview_clip_url);
    if (item.streaming_provider === 'cloudflare_stream' && item.provider_video_id) {
      const params = new URLSearchParams({
        autoplay: 'true',
        muted: 'true',
        loop: 'true',
        controls: 'false',
        preload: 'true',
        poster: getCloudflareThumbnailUrl(item.provider_video_id, 480)
      });
      return `https://iframe.videodelivery.net/${item.provider_video_id}?${params.toString()}`;
    }
    return '';
  }

  function startPreview(thumb, item) {
    if (thumb.querySelector('video, iframe')) return;

    if (item?.streaming_provider === 'cloudflare_stream' && item?.provider_video_id && !item?.preview_clip_url) {
      const frame = document.createElement('iframe');
      frame.src = getPreviewUrl(item);
      frame.className = 'card-preview-frame';
      frame.title = `${item.title || 'Content'} preview`;
      frame.allow = 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      thumb.appendChild(frame);
      requestAnimationFrame(() => {
        frame.classList.add('active');
      });
      return;
    }

    const video = document.createElement('video');
    video.src = getPreviewUrl(item);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.className = 'card-preview-video';
    thumb.appendChild(video);
    requestAnimationFrame(() => {
      video.classList.add('active');
      video.play().catch(() => {});
    });
  }

  function stopPreview(thumb) {
    const video = thumb.querySelector('video');
    if (video) {
      video.pause();
      video.remove();
    }
    const frame = thumb.querySelector('iframe');
    if (frame) {
      frame.remove();
    }
  }

  /**
   * Wires hover-to-preview onto a card. `thumbSelector` lets each page pass
   * its own thumbnail class (movies.js's cards use
   * '.upload-card__thumb, .top10-thumb'; home-feed cards use
   * '.card-thumbnail') instead of hardcoding one page's DOM structure.
   */
  async function attachHoverPreview(cardEl, item, thumbSelector) {
    if (!getPreviewUrl(item)) return;
    if (window.matchMedia('(hover: none)').matches) return;
    if (!(await getAutoplayPreviewsEnabled())) return;

    const thumb = cardEl.querySelector(thumbSelector || '.card-thumbnail');
    if (!thumb) return;

    cardEl.addEventListener('mouseenter', () => {
      const timer = setTimeout(() => startPreview(thumb, item), HOVER_DELAY);
      hoverTimers.set(cardEl, timer);
    });

    cardEl.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimers.get(cardEl));
      stopPreview(thumb);
    });
  }

  window.BSCPreviewClips = {
    getPreviewUrl,
    getCloudflareThumbnailUrl,
    fixMediaUrl,
    attachHoverPreview
  };
})();
