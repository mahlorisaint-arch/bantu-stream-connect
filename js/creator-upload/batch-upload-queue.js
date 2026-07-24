// ============================================
// BATCH UPLOAD QUEUE
// Activated when 2+ files are selected/dropped for a genre that supports
// collections (Music/Series/Podcast). Files upload sequentially through the
// existing BANTU_UPLOAD_ENGINE (compressAudio() blocks the main thread, so
// items are never uploaded in parallel), then get linked into one
// creator_playlists collection via collection-linking.js. Exactly 1 file
// never touches this file — selectedMediaFile/handleMediaFile() stay
// authoritative and unchanged for that case.
// ============================================

let batchQueue = [];
let batchModeActive = false;
let selectedCollectionCoverFile = null;
let batchIdCounter = 0;
let defaultSuccessMessageHtml = null;

let currentBatchPlaylistId = null;
let currentBatchCollectionName = null;
let currentBatchSeasonNumber = null;
let currentBatchCoverArtUrl = null;

function isBatchModeSupported(genre) {
    const cfg = genreConfig[genre];
    return !!(cfg && cfg.uses_playlist);
}

function deriveDefaultTitle(filename) {
    const withoutExt = filename.replace(/\.[^/.]+$/, '');
    const spaced = withoutExt.replace(/[_-]+/g, ' ').trim();
    if (!spaced) return filename;
    return spaced.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function findBatchRow(localId) {
    return batchQueue.find(r => r.localId === localId);
}

function initBatchQueue(files) {
    const genre = document.getElementById('content-genre').value;
    if (!isBatchModeSupported(genre)) return;

    const existingKeys = new Set(batchQueue.map(r => `${r.file.name}_${r.file.size}`));

    files.forEach(file => {
        const key = `${file.name}_${file.size}`;
        if (existingKeys.has(key)) return;

        const check = isValidMediaFile(file);
        if (!check.valid) { showToast(`${file.name}: ${check.reason}`); return; }

        const row = {
            localId: `batch-${batchIdCounter++}`,
            file,
            title: deriveDefaultTitle(file.name),
            number: batchQueue.length + 1,
            status: 'queued',
            errorMessage: null,
            contentId: null,
            extractedDuration: null,
            thumbnailFile: null,
            _assignedSortIndex: null
        };
        batchQueue.push(row);
        existingKeys.add(key);
        preExtractRowMetadata(row);
    });

    if (!batchQueue.length) return;

    batchModeActive = true;
    selectedMediaFile = null;

    showBatchQueueUI();
    renderBatchQueue();
    if (typeof updateGenreForm === 'function') updateGenreForm(true);
    if (typeof updateButtonsState === 'function') updateButtonsState();
    if (typeof updateChecklist === 'function') updateChecklist();
    if (typeof saveDraftToLocalStorage === 'function') saveDraftToLocalStorage();
}

async function preExtractRowMetadata(row) {
    try {
        row.extractedDuration = await extractMediaDuration(row.file);
    } catch (e) {
        row.extractedDuration = null;
    }
    if (row.file.type.includes('video')) {
        try {
            row.thumbnailFile = await generateVideoThumbnail(row.file);
        } catch (e) {
            row.thumbnailFile = null;
        }
    }
    updateBatchRowMeta(row.localId);
}

function updateBatchRowMeta(localId) {
    const row = findBatchRow(localId);
    const el = document.getElementById(`batch-row-${localId}`);
    if (!row || !el) return;
    const filenameEl = el.querySelector('.batch-row-filename');
    if (filenameEl) {
        filenameEl.textContent = row.extractedDuration !== null
            ? `${row.file.name} • ${formatTime(row.extractedDuration)}`
            : row.file.name;
    }
}

function showBatchQueueUI() {
    const section = document.getElementById('batch-queue-section');
    const fileInfo = document.getElementById('media-file-info');
    const zoneText = document.getElementById('media-zone-text');
    if (section) section.classList.add('active');
    if (fileInfo) fileInfo.style.display = 'none';
    if (zoneText) zoneText.textContent = `${batchQueue.length} files selected — click to add more`;
}

function hideBatchQueueUI() {
    const section = document.getElementById('batch-queue-section');
    const zoneText = document.getElementById('media-zone-text');
    if (section) section.classList.remove('active');
    if (zoneText) zoneText.textContent = 'Click or drag video/audio files here';
}

function batchStatusLabel(row) {
    switch (row.status) {
        case 'queued': return 'Queued';
        case 'uploading': return 'Uploading…';
        case 'done': return 'Published';
        case 'failed': return 'Failed';
        case 'published-unlinked': return 'Published (not in album)';
        default: return row.status;
    }
}

function renderBatchQueue() {
    const list = document.getElementById('batch-queue-list');
    const countEl = document.getElementById('batch-queue-count');
    if (!list) return;

    if (countEl) countEl.textContent = batchQueue.length;

    list.innerHTML = batchQueue.map(row => `
        <div class="batch-row" id="batch-row-${row.localId}" data-status="${row.status}">
            <div class="batch-row-thumb"><i class="fas ${row.file.type.includes('audio') ? 'fa-music' : 'fa-video'}"></i></div>
            <div class="batch-row-fields">
                <input type="text" class="form-input batch-row-title" data-local-id="${row.localId}" placeholder="Title" value="${escapeHtml(row.title)}">
                <input type="number" class="form-input batch-row-number" data-local-id="${row.localId}" min="1" value="${row.number}" title="Track/Episode number">
            </div>
            <div class="batch-row-meta">
                <span class="batch-row-filename">${escapeHtml(row.extractedDuration !== null ? `${row.file.name} • ${formatTime(row.extractedDuration)}` : row.file.name)}</span>
                <span class="batch-row-status-badge">${batchStatusLabel(row)}</span>
            </div>
            <div class="batch-row-progress"><div class="batch-row-progress-fill" style="width:0%"></div></div>
            <div class="batch-row-actions">
                <button type="button" class="batch-row-retry" data-local-id="${row.localId}" style="display:${(row.status === 'failed' || row.status === 'published-unlinked') ? 'flex' : 'none'}" title="Retry"><i class="fas fa-rotate-right"></i></button>
                <button type="button" class="batch-row-remove" data-local-id="${row.localId}" title="Remove"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.batch-row-title').forEach(input => {
        input.addEventListener('input', (e) => {
            const row = findBatchRow(e.target.dataset.localId);
            if (row) { row.title = e.target.value; saveDraftToLocalStorage(); }
        });
    });
    list.querySelectorAll('.batch-row-number').forEach(input => {
        input.addEventListener('input', (e) => {
            const row = findBatchRow(e.target.dataset.localId);
            if (row) { row.number = parseInt(e.target.value, 10) || row.number; saveDraftToLocalStorage(); }
        });
    });
    list.querySelectorAll('.batch-row-remove').forEach(btn => {
        btn.addEventListener('click', (e) => removeBatchRow(e.currentTarget.dataset.localId));
    });
    list.querySelectorAll('.batch-row-retry').forEach(btn => {
        btn.addEventListener('click', (e) => retryBatchRow(e.currentTarget.dataset.localId));
    });
}

function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function collapseToSingleFile() {
    const row = batchQueue[0];
    batchQueue = [];
    batchModeActive = false;
    hideBatchQueueUI();

    if (typeof updateGenreForm === 'function') updateGenreForm(false);
    handleMediaFile(row.file);

    const genre = document.getElementById('content-genre').value;
    if (genre === 'Music') {
        setFieldValue('field-track_title', row.title);
        setFieldValue('field-track_number', row.number);
    } else if (genre === 'Series' || genre === 'Podcast') {
        setFieldValue('field-episode_title', row.title);
        setFieldValue('field-episode_number', row.number);
    }
    if (typeof updateChecklist === 'function') updateChecklist();
    if (typeof updateButtonsState === 'function') updateButtonsState();
}

function removeBatchRow(localId) {
    const idx = batchQueue.findIndex(r => r.localId === localId);
    if (idx === -1) return;
    batchQueue.splice(idx, 1);

    if (batchQueue.length === 0) {
        batchModeActive = false;
        hideBatchQueueUI();
        renderBatchQueue();
        if (typeof updateButtonsState === 'function') updateButtonsState();
        return;
    }

    if (batchQueue.length === 1) {
        collapseToSingleFile();
        return;
    }

    renderBatchQueue();
    if (typeof updateButtonsState === 'function') updateButtonsState();
    if (typeof saveDraftToLocalStorage === 'function') saveDraftToLocalStorage();
}

function validateBatchQueue() {
    let allValid = true;
    batchQueue.forEach(row => {
        const el = document.querySelector(`#batch-row-${row.localId} .batch-row-title`);
        const isValid = !!row.title && row.title.trim().length > 0;
        if (el) el.classList.toggle('invalid', !isValid);
        if (!isValid) allValid = false;
    });
    if (!allValid) showToast('Every item needs a title', 'error');
    return allValid;
}

function setRowStatus(row, status, errorMessage = null) {
    row.status = status;
    row.errorMessage = errorMessage;
    const el = document.getElementById(`batch-row-${row.localId}`);
    if (!el) return;
    el.dataset.status = status;
    const badge = el.querySelector('.batch-row-status-badge');
    if (badge) badge.textContent = batchStatusLabel(row);
    const retryBtn = el.querySelector('.batch-row-retry');
    if (retryBtn) retryBtn.style.display = (status === 'failed' || status === 'published-unlinked') ? 'flex' : 'none';
}

function updateRowProgress(row, progress) {
    const el = document.getElementById(`batch-row-${row.localId}`);
    if (!el) return;
    const fill = el.querySelector('.batch-row-progress-fill');
    if (fill && typeof progress.percent === 'number') fill.style.width = `${progress.percent}%`;
}

function setBatchProgressLabel(text) {
    const label = document.getElementById('batch-queue-progress-label');
    if (label) label.textContent = text;
}

function lockCollectionFields(lock) {
    const genre = document.getElementById('content-genre').value;
    const idsToLock = genre === 'Music' ? ['field-album_title'] : ['field-show_title'];
    idsToLock.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = lock;
    });
}

function buildRowMetadata(genre, sharedMeta, row) {
    const merged = { ...sharedMeta };
    if (genre === 'Music') {
        merged.track_title = row.title;
        merged.track_number = row.number;
    } else {
        merged.episode_title = row.title;
        merged.episode_number = row.number;
    }
    return merged;
}

function setupCollectionCoverUpload() {
    const zone = document.getElementById('collection-cover-upload-zone');
    const input = document.getElementById('collection-cover-file-input');
    if (!zone || !input) return;
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
        if (e.target.files.length) handleCollectionCoverFile(e.target.files[0]);
    });
}

function handleCollectionCoverFile(file) {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!imageTypes.includes(file.type)) { showToast('Please select a valid image file'); return; }
    selectedCollectionCoverFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('collection-cover-image');
        const preview = document.getElementById('collection-cover-preview');
        if (img) img.src = e.target.result;
        if (preview) preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
    showToast('Cover art selected', 'success');
}

async function runBatchUpload(isDraft) {
    if (!currentUserId) {
        showToast('Please sign in to upload content');
        authModal.classList.add('active');
        return;
    }

    const title = document.getElementById('content-title').value.trim();
    const desc = document.getElementById('content-description').value.trim();
    const genre = document.getElementById('content-genre').value;
    const contentFormat = document.getElementById('content_format').value;
    const cfg = genreConfig[genre];

    if (!title || !desc) { showToast('Please fill in title and description'); return; }
    if (!cfg || !cfg.uses_playlist) { showToast('Please select a genre that supports albums/seasons'); return; }
    if (!validateGenreMetadata(true)) return;
    if (!validateBatchQueue()) return;

    const sharedMeta = collectContentMetadata() || {};
    const collectionName = buildCollectionName(genre, sharedMeta);
    if (!collectionName) {
        showToast(genre === 'Music' ? 'Album Title is required for a multi-track upload' : 'Show Title is required for a multi-episode upload', 'error');
        return;
    }

    isUploading = true;
    updateButtonsState();
    lockCollectionFields(true);
    setBatchProgressLabel('Setting up your collection...');

    let sharedCoverArtUrl = null;
    if (selectedCollectionCoverFile) {
        setBatchProgressLabel('Uploading cover art...');
        sharedCoverArtUrl = await uploadThumbnailOnly(selectedCollectionCoverFile);
    }

    let playlistInfo;
    try {
        playlistInfo = await findOrCreateCreatorPlaylist({
            creatorId: currentUserId,
            name: collectionName,
            playlistType: cfg.playlist_type,
            genre: genre,
            description: genre !== 'Music' ? (sharedMeta.series_description || null) : null,
            coverArtUrl: sharedCoverArtUrl
        });
    } catch (err) {
        console.error('Could not create/find collection:', err);
        showToast(`Could not set up the collection: ${err.message}`, 'error');
        isUploading = false;
        lockCollectionFields(false);
        updateButtonsState();
        setBatchProgressLabel('Ready to publish');
        return;
    }

    const seasonNumber = genre !== 'Music' ? (sharedMeta.season_number ? parseInt(sharedMeta.season_number, 10) : null) : null;
    const itemType = genre === 'Music' ? 'track' : 'episode';

    currentBatchPlaylistId = playlistInfo.playlistId;
    currentBatchCollectionName = collectionName;
    currentBatchSeasonNumber = seasonNumber;
    currentBatchCoverArtUrl = sharedCoverArtUrl;

    let nextSortIndex = playlistInfo.nextSortIndex;

    for (const row of batchQueue) {
        if (row.status === 'done' || row.status === 'published-unlinked') continue;

        setRowStatus(row, 'uploading');
        const position = batchQueue.indexOf(row) + 1;
        setBatchProgressLabel(`Uploading ${position} of ${batchQueue.length}: ${row.title}`);

        if (row._assignedSortIndex === null) {
            row._assignedSortIndex = nextSortIndex++;
        }

        const formData = {
            title: row.title,
            description: desc,
            genre: genre,
            contentFormat: contentFormat || null,
            genreSpecificMetadata: buildRowMetadata(genre, sharedMeta, row),
            duration: row.extractedDuration,
            chapters: null,
            collection: {
                name: collectionName,
                playlistType: cfg.playlist_type,
                itemType: itemType,
                trackNumber: genre === 'Music' ? row.number : null,
                seasonNumber: seasonNumber,
                displayTitle: row.title,
                sortIndex: row._assignedSortIndex,
                coverArtUrl: sharedCoverArtUrl,
                playlistId: currentBatchPlaylistId
            }
        };

        try {
            await new Promise((resolve, reject) => {
                BANTU_UPLOAD_ENGINE.processCreatorPublish(formData, row.file, row.thumbnailFile || null, {
                    updateStatus: (msg) => setBatchProgressLabel(`${msg} (${position} of ${batchQueue.length})`),
                    onProgress: (p) => updateRowProgress(row, p),
                    onSuccess: (content) => {
                        row.contentId = content.id;
                        setRowStatus(row, content._linkWarning ? 'published-unlinked' : 'done', content._linkWarning || null);
                        resolve();
                    },
                    onError: (err) => { setRowStatus(row, 'failed', err); reject(new Error(err)); }
                });
            });
        } catch (e) {
            console.error(`Batch item failed: ${row.file.name}`, e);
        }
    }

    finalizeBatchUpload();
}

async function retryBatchRow(localId) {
    const row = findBatchRow(localId);
    if (!row || !currentBatchPlaylistId) {
        showToast('Cannot retry — publish the batch again to set up the collection.', 'error');
        return;
    }

    const genre = document.getElementById('content-genre').value;
    const cfg = genreConfig[genre];
    const itemType = genre === 'Music' ? 'track' : 'episode';

    if (row.status === 'published-unlinked' && row.contentId) {
        setRowStatus(row, 'uploading');
        try {
            await linkContentToCollection(currentBatchPlaylistId, row.contentId, {
                sortIndex: row._assignedSortIndex,
                itemType,
                trackNumber: genre === 'Music' ? row.number : null,
                seasonNumber: currentBatchSeasonNumber,
                displayTitleOverride: row.title
            });
            setRowStatus(row, 'done');
            showToast(`"${row.title}" linked to the collection`, 'success');
        } catch (err) {
            setRowStatus(row, 'published-unlinked', err.message);
            showToast(`Still couldn't link "${row.title}": ${err.message}`, 'error');
        }
        return;
    }

    setRowStatus(row, 'uploading');
    const sharedMeta = collectContentMetadata() || {};
    const desc = document.getElementById('content-description').value.trim();
    const contentFormat = document.getElementById('content_format').value;

    const formData = {
        title: row.title,
        description: desc,
        genre: genre,
        contentFormat: contentFormat || null,
        genreSpecificMetadata: buildRowMetadata(genre, sharedMeta, row),
        duration: row.extractedDuration,
        chapters: null,
        collection: {
            name: currentBatchCollectionName,
            playlistType: cfg.playlist_type,
            itemType,
            trackNumber: genre === 'Music' ? row.number : null,
            seasonNumber: currentBatchSeasonNumber,
            displayTitle: row.title,
            sortIndex: row._assignedSortIndex ?? 0,
            coverArtUrl: currentBatchCoverArtUrl,
            playlistId: currentBatchPlaylistId
        }
    };

    BANTU_UPLOAD_ENGINE.processCreatorPublish(formData, row.file, row.thumbnailFile || null, {
        updateStatus: () => {},
        onProgress: (p) => updateRowProgress(row, p),
        onSuccess: (content) => {
            row.contentId = content.id;
            setRowStatus(row, content._linkWarning ? 'published-unlinked' : 'done', content._linkWarning || null);
            showToast(`"${row.title}" published`, 'success');
        },
        onError: (err) => {
            setRowStatus(row, 'failed', err);
            showToast(`Retry failed for "${row.title}": ${err}`, 'error');
        }
    });
}

function finalizeBatchUpload() {
    const doneCount = batchQueue.filter(r => r.status === 'done' || r.status === 'published-unlinked').length;
    const failedCount = batchQueue.filter(r => r.status === 'failed').length;

    isUploading = false;
    lockCollectionFields(false);
    updateButtonsState();

    if (failedCount === 0) {
        setBatchProgressLabel(`${doneCount} of ${batchQueue.length} published`);
        showSuccessStateForBatch(doneCount);
    } else {
        setBatchProgressLabel(`${doneCount} of ${batchQueue.length} published, ${failedCount} failed`);
        showToast(`${doneCount} of ${batchQueue.length} items published. ${failedCount} failed — retry below.`, 'error');
    }
}

function showSuccessStateForBatch(doneCount) {
    const msgEl = document.getElementById('success-message-text');
    if (msgEl) {
        if (defaultSuccessMessageHtml === null) defaultSuccessMessageHtml = msgEl.innerHTML;
        msgEl.innerHTML = `${doneCount} item${doneCount !== 1 ? 's' : ''} published to "${escapeHtml(currentBatchCollectionName || 'your collection')}"!<br>We're starting to show it to viewers who enjoy this type of content.`;
    }
    uploadFormState.style.display = 'none';
    successState.classList.add('active');
    if (typeof triggerConfetti === 'function') triggerConfetti();
    localStorage.removeItem(`draft_${currentUserId}`);
}

function resetBatchState() {
    batchQueue = [];
    batchModeActive = false;
    selectedCollectionCoverFile = null;
    currentBatchPlaylistId = null;
    currentBatchCollectionName = null;
    currentBatchSeasonNumber = null;
    currentBatchCoverArtUrl = null;
    hideBatchQueueUI();
    setBatchProgressLabel('Ready to publish');

    const msgEl = document.getElementById('success-message-text');
    if (msgEl && defaultSuccessMessageHtml !== null) msgEl.innerHTML = defaultSuccessMessageHtml;

    const coverPreview = document.getElementById('collection-cover-preview');
    if (coverPreview) coverPreview.style.display = 'none';
}

window.isBatchModeSupported = isBatchModeSupported;
window.initBatchQueue = initBatchQueue;
window.resetBatchState = resetBatchState;
window.runBatchUpload = runBatchUpload;
window.setupCollectionCoverUpload = setupCollectionCoverUpload;
