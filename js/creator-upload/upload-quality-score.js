// ============================================
// UPLOAD QUALITY SCORE FUNCTIONS
// ============================================
function updateChecklist() {
    const title = document.getElementById('content-title').value.trim();
    const desc = document.getElementById('content-description').value.trim();
    const genre = document.getElementById('content-genre').value;
    const config = genreConfig[genre];
    let score = 0;
    
    if (title.length > 5) {
        document.getElementById('check-title').classList.add('completed');
        document.getElementById('check-title').innerHTML = '<i class="fas fa-check-circle"></i> Compelling Title';
        score += 15;
    } else {
        document.getElementById('check-title').classList.remove('completed');
        document.getElementById('check-title').innerHTML = '<i class="far fa-circle"></i> Compelling Title';
    }
    
    if (desc.length > 20) {
        document.getElementById('check-desc').classList.add('completed');
        document.getElementById('check-desc').innerHTML = '<i class="fas fa-check-circle"></i> Detailed Description';
        score += 15;
    } else {
        document.getElementById('check-desc').classList.remove('completed');
        document.getElementById('check-desc').innerHTML = '<i class="far fa-circle"></i> Detailed Description';
    }
    
    if (selectedMediaType === 'news' || selectedMediaFile) {
        document.getElementById('check-media').classList.add('completed');
        document.getElementById('check-media').innerHTML = '<i class="fas fa-check-circle"></i> Media File Uploaded';
        score += 20;
    } else {
        document.getElementById('check-media').classList.remove('completed');
        document.getElementById('check-media').innerHTML = '<i class="far fa-circle"></i> Media File Uploaded';
    }
    
    if (selectedThumbnailFile) {
        document.getElementById('check-thumb').classList.add('completed');
        document.getElementById('check-thumb').innerHTML = '<i class="fas fa-check-circle"></i> Custom Thumbnail <span style="color:var(--warm-gold);font-size:12px;margin-left:5px">(2x more clicks)</span>';
        score += 20;
    } else {
        document.getElementById('check-thumb').classList.remove('completed');
        document.getElementById('check-thumb').innerHTML = '<i class="far fa-circle"></i> Custom Thumbnail <span style="color:var(--warm-gold);font-size:12px;margin-left:5px">(2x more clicks)</span>';
        score += 10;
    }
    
    if (genre) {
        document.getElementById('check-genre').classList.add('completed');
        document.getElementById('check-genre').innerHTML = '<i class="fas fa-check-circle"></i> Genre Selected';
        score += 15;
    } else {
        document.getElementById('check-genre').classList.remove('completed');
        document.getElementById('check-genre').innerHTML = '<i class="far fa-circle"></i> Genre Selected';
    }
    
    const isMovieContent = config?.isMovieContent;
    const isPodcastContent = config?.isPodcastContent;
    const isNews = selectedMediaType === 'news';
    let hasMetadata = false;
    
    if (isNews) {
        const source = document.getElementById('news-source')?.value?.trim();
        const category = document.getElementById('news-category')?.value;
        const articleBody = document.getElementById('article-body')?.value?.trim();
        hasMetadata = !!(source && category && articleBody);
    } else if (isPodcastContent) {
        const podcastMeta = collectPodcastMetadata();
        hasMetadata = !!(podcastMeta?.show_title && podcastMeta?.category && podcastMeta?.language && podcastMeta?.country);
    } else if (isMovieContent) {
        hasMetadata = selectedGenres.length > 0 && selectedSAGenres.length > 0 && selectedMood;
    } else if (config) {
        hasMetadata = config.fields.some(f => {
            if (f.required) {
                const el = document.getElementById(`field-${f.name}`);
                if (f.type === 'tags') {
                    const cont = el?.closest('.tags-input-container');
                    return cont?.dataset.tags && JSON.parse(cont.dataset.tags).length > 0;
                } else if (f.type === 'radio') {
                    const selected = document.querySelector(`input[name="field-${f.name}"]:checked`);
                    return !!selected;
                }
                return el && el.value;
            }
            return false;
        });
    } else {
        hasMetadata = true;
    }
    
    if (hasMetadata || !config) {
        document.getElementById('check-metadata').classList.add('completed');
        document.getElementById('check-metadata').innerHTML = '<i class="fas fa-check-circle"></i> Genre Metadata Completed';
        score += 15;
    } else {
        document.getElementById('check-metadata').classList.remove('completed');
        document.getElementById('check-metadata').innerHTML = '<i class="far fa-circle"></i> Genre Metadata Completed';
    }
    
    document.getElementById('quality-score').textContent = `${score}%`;
}
