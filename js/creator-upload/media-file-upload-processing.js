// ============================================
// MEDIA FILE UPLOAD & PROCESSING FUNCTIONS
// ============================================
function extractMediaDuration(file) {
    return new Promise((resolve, reject) => {
        const media = document.createElement(file.type.includes('audio') ? 'audio' : 'video');
        media.preload = 'metadata';
        const timeout = setTimeout(() => { URL.revokeObjectURL(media.src); reject(new Error('Duration extraction timeout')); }, 10000);
        media.onloadedmetadata = () => { clearTimeout(timeout); const duration = Math.floor(media.duration); URL.revokeObjectURL(media.src); resolve(duration); };
        media.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(media.src); reject(new Error('Failed to load metadata')); };
        media.src = URL.createObjectURL(file);
    });
}

async function validateMediaFile(file) {
    const durationDisplay = document.getElementById('duration-display');
    const durationText = document.getElementById('duration-text');
    const durationStatus = document.getElementById('duration-status');
    const durationBadge = document.getElementById('duration-badge');
    extractedDuration = null;
    
    if (file.type.includes('video') || file.type.includes('audio')) {
        durationDisplay.style.display = 'flex';
        durationText.textContent = `Duration: extracting...`;
        durationStatus.textContent = '';
        durationBadge.style.display = 'none';
        
        try {
            const duration = await extractMediaDuration(file);
            extractedDuration = duration;
            const mediaIcon = file.type.includes('audio') ? 'fa-music' : 'fa-video';
            durationText.innerHTML = `Duration: ${formatTime(duration)} <i class="fas ${mediaIcon}"></i>`;
            durationBadge.style.display = 'inline-block';

            if (file.type.includes('audio')) {
                durationDisplay.classList.add('valid');
                durationStatus.innerHTML = '<i class="fas fa-check"></i> Audio file';
            } else if (selectedMediaType === 'short') {
                if (duration > 60) {
                    durationDisplay.classList.add('invalid');
                    durationStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Too long for Shorts (max 60s)';
                } else {
                    durationDisplay.classList.add('valid');
                    durationStatus.innerHTML = '<i class="fas fa-check"></i> Valid for Shorts';
                }
            }
            
            if (file.type.includes('video') && !selectedThumbnailFile) {
                try {
                    const thumb = await generateVideoThumbnail(file);
                    handleThumbnailFile(thumb, true);
                } catch(e) { console.error('Auto-thumb fail', e); }
            }
        } catch (error) {
            durationText.textContent = `Duration: unknown`;
            durationStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Could not read duration';
            durationDisplay.classList.add('invalid');
        }
    } else {
        durationDisplay.style.display = 'none';
    }
    
    updateButtonsState();
    updateChecklist();
}

const MEDIA_MAX_SIZE = 800 * 1024 * 1024;
const MEDIA_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
const MEDIA_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/wav', 'audio/ogg'];

function isValidMediaFile(file) {
    if (file.size > MEDIA_MAX_SIZE) return { valid: false, reason: 'File size must be less than 800MB' };
    const isValidType = [...MEDIA_VIDEO_TYPES, ...MEDIA_AUDIO_TYPES].some(type => file.type.includes(type.split('/')[1]) || file.type === type);
    if (!isValidType) return { valid: false, reason: 'Please select a valid video or audio file' };
    return { valid: true };
}

function handleMediaFile(file) {
    const check = isValidMediaFile(file);
    if (!check.valid) { showToast(check.reason); return; }

    selectedMediaFile = file;
    const fileIcon = file.type.includes('audio') ? 'fa-music' : 'fa-video';
    document.getElementById('file-icon').innerHTML = `<i class="fas ${fileIcon}"></i>`;
    document.getElementById('media-file-name').textContent = file.name;
    document.getElementById('media-file-size').textContent = formatFileSize(file.size);
    document.getElementById('media-file-info').style.display = 'flex';
    document.getElementById('media-zone-text').textContent = 'Click to change file';
    
    validateMediaFile(file);
    saveDraftToLocalStorage();
}

function handleMediaFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;

    if (files.length === 1 && (typeof batchQueue === 'undefined' || batchQueue.length === 0)) {
        handleMediaFile(files[0]);
        return;
    }

    const genre = document.getElementById('content-genre').value;
    const supportsBatch = typeof isBatchModeSupported === 'function' && isBatchModeSupported(genre);

    if (!supportsBatch) {
        showToast(`Multiple files aren't supported for ${genre || 'this content type'} — using the first file only.`, 'info');
        handleMediaFile(files[0]);
        return;
    }

    if (typeof initBatchQueue === 'function') {
        initBatchQueue(files);
    } else {
        handleMediaFile(files[0]);
    }
}

function setupMediaUpload() {
    const zone = document.getElementById('media-upload-zone');
    const input = document.getElementById('media-file-input');
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => { if (e.target.files.length) handleMediaFiles(e.target.files); });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.borderColor = 'var(--warm-gold)'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = 'rgba(255,255,255,.3)'; });
    zone.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleMediaFiles(e.dataTransfer.files); });
}
