// Single source of truth for resolving a Content row into a playable video
// URL, mirroring mobile's MediaUrl.playableUrl() exactly (see
// BantuStreamConnect-Mobile/lib/global/utils/media_url.dart). Replaces the
// videodelivery.net/{uid}/manifest/video.m3u8 URL construction that used to
// be duplicated across content-detail, shorts-detail, hero-content, movies,
// and preview-clips.
function getPlayableVideoUrl(content) {
  if (!content) return null;
  if (content.streaming_provider === 'cloudflare_stream' && content.provider_video_id) {
    return `https://videodelivery.net/${content.provider_video_id}/manifest/video.m3u8`;
  }
  if (content.hls_manifest_url) {
    return content.hls_manifest_url;
  }
  return content.file_url || null;
}

window.getPlayableVideoUrl = getPlayableVideoUrl;
