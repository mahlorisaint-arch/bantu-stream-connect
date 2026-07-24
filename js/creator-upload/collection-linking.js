// ============================================
// COLLECTION LINKING (creator_playlists / playlist_contents / creator_playlist_items)
// The only write path into the album/series/podcast-season schema on this
// page. Used by BOTH the single-item upload flow and the batch upload queue
// so a single track with an album title and a full album upload produce
// identical, consistent data. Writes to BOTH junction tables — different
// pages (my-uploads.html vs creator-channel.js/content-collections-engine.js)
// read different ones, and both must stay populated to keep the collection
// visible everywhere it's expected.
// ============================================

function buildCollectionName(genre, metadata) {
    if (genre === 'Music') return metadata?.album_title?.trim() || null;
    if (genre === 'Series' || genre === 'Podcast') return metadata?.show_title?.trim() || null;
    return null;
}

async function getNextSortIndex(playlistId) {
    const { data, error } = await window.supabaseClient
        .from('playlist_contents')
        .select('sort_index')
        .eq('playlist_id', playlistId)
        .order('sort_index', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return 0;
    return (data.sort_index ?? -1) + 1;
}

async function findOrCreateCreatorPlaylist({ creatorId, name, playlistType, genre, description, coverArtUrl }) {
    const trimmedName = name.trim();

    const { data: existing, error: lookupError } = await window.supabaseClient
        .from('creator_playlists')
        .select('id')
        .eq('creator_id', creatorId)
        .eq('playlist_type', playlistType)
        .ilike('name', trimmedName)
        .maybeSingle();

    if (lookupError) throw new Error(`Collection lookup failed: ${lookupError.message}`);

    if (existing) {
        const nextSortIndex = await getNextSortIndex(existing.id);
        return { playlistId: existing.id, nextSortIndex };
    }

    // Column set verified directly against the live schema (via read probes
    // against real rows), not just static grep — this table has already
    // burned two rounds on columns that looked plausible in other files but
    // don't actually exist here: no `genre` (recommendation-engine.js
    // references one, but that code path is apparently untested/broken
    // elsewhere) and no `status`. `sort_order` on every real row is the
    // string "manual" (a sort STRATEGY, not a numeric position) — omitted
    // here so its column default applies rather than guessing at the value.
    // visibility: 'public' is load-bearing — the bantu-waves-* home-feed
    // carousels hard-filter .eq('visibility','public'), so a published album
    // with no visibility set would silently never appear on the home feed.
    const { data: created, error: createError } = await window.supabaseClient
        .from('creator_playlists')
        .insert([{
            name: trimmedName,
            description: description || null,
            playlist_type: playlistType,
            custom_thumbnail_url: coverArtUrl || null,
            visibility: 'public',
            creator_id: creatorId
        }])
        .select('id')
        .single();

    if (createError) throw new Error(`Could not create collection: ${createError.message}`);

    return { playlistId: created.id, nextSortIndex: 0 };
}

async function linkContentToCollection(playlistId, contentId, { sortIndex, itemType, trackNumber, seasonNumber, displayTitleOverride }) {
    // item_type is uppercase ('TRACK'/'EPISODE') on every existing row —
    // matched here even though nothing currently reads it case-sensitively,
    // to stay consistent with real data rather than introduce a second casing.
    const { error: pcError } = await window.supabaseClient
        .from('playlist_contents')
        .insert([{
            playlist_id: playlistId,
            content_id: contentId,
            sort_index: sortIndex,
            item_type: itemType,
            track_number: trackNumber ?? null,
            disc_number: itemType === 'TRACK' ? 1 : null,
            season_number: seasonNumber ?? null,
            display_title_override: displayTitleOverride ?? null
        }]);

    if (pcError) throw new Error(`playlist_contents insert failed: ${pcError.message}`);

    const { error: cpiError } = await window.supabaseClient
        .from('creator_playlist_items')
        .insert([{
            playlist_id: playlistId,
            content_id: contentId,
            position: sortIndex
        }]);

    if (cpiError) throw new Error(`creator_playlist_items insert failed: ${cpiError.message}`);
}

window.buildCollectionName = buildCollectionName;
window.findOrCreateCreatorPlaylist = findOrCreateCreatorPlaylist;
window.linkContentToCollection = linkContentToCollection;
