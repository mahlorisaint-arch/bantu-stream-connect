// ============================================
// GENRE CONFIGURATION
// ============================================
const genreConfig = {
    'Film': {
        title: 'Film Details',
        fields: [
            { name: 'director', type: 'text', label: 'Director', required: true, placeholder: 'e.g., Ava DuVernay' },
            { name: 'cast', type: 'tags', label: 'Cast', required: false, placeholder: 'e.g., Actor 1, Actor 2' },
            { name: 'release_year', type: 'number', label: 'Release Year', required: true, min: 1900, max: new Date().getFullYear() },
            { name: 'certification', type: 'select', label: 'Certification', required: true, options: ['G', 'PG', 'PG-13', 'R', 'NC-17', 'Not Rated'] },
            { name: 'production_company', type: 'text', label: 'Production Company', required: false, placeholder: 'e.g., Bantu Studios' }
        ],
        content_format: 'film',
        requires_chapters: false,
        requires_mood: true,
        isMovieContent: true
    },
    'Documentary': {
        title: 'Documentary Details',
        fields: [
            { name: 'director', type: 'text', label: 'Director', required: true, placeholder: 'e.g., Ava DuVernay' },
            { name: 'subject_matter', type: 'tags', label: 'Subject Matter', required: true, placeholder: 'e.g., Nature, Politics, History' },
            { name: 'interview_subjects', type: 'tags', label: 'Interview Subjects', required: false, placeholder: 'e.g., Person 1, Person 2' },
            { name: 'production_year', type: 'number', label: 'Production Year', required: true, min: 1900, max: new Date().getFullYear() },
            { name: 'research_sources', type: 'tags', label: 'Research Sources', required: false, placeholder: 'e.g., University, Archive' },
            { name: 'certification', type: 'select', label: 'Certification', required: true, options: ['G', 'PG', 'PG-13', 'R', 'Not Rated'] }
        ],
        content_format: 'documentary',
        requires_chapters: false,
        requires_mood: true,
        isMovieContent: true
    },
    'Series': {
        title: 'Series Episode Details',
        fields: [
            { name: 'show_title', type: 'text', label: 'Show Title', required: true, placeholder: 'e.g., Bantu Stories' },
            { name: 'season_number', type: 'number', label: 'Season Number', required: true, min: 1 },
            { name: 'episode_number', type: 'number', label: 'Episode Number', required: true, min: 1, perItem: true },
            { name: 'episode_title', type: 'text', label: 'Episode Title', required: true, placeholder: 'e.g., The Beginning', perItem: true },
            { name: 'series_description', type: 'textarea', label: 'Series Description', required: false, rows: 3 }
        ],
        content_format: 'series_episode',
        requires_chapters: true,
        requires_mood: true,
        uses_playlist: true,
        playlist_type: 'series',
        isMovieContent: true
    },
    'Music': {
        title: 'Music Details',
        fields: [
            { name: 'track_title', type: 'text', label: 'Track Title', required: true, placeholder: 'e.g., Rise Up', perItem: true },
            { name: 'artist_name', type: 'text', label: 'Artist Name', required: true, placeholder: 'e.g., Bantu Artist' },
            { name: 'album_title', type: 'text', label: 'Album Title', required: false, placeholder: 'e.g., African Dreams' },
            { name: 'track_number', type: 'number', label: 'Track Number', required: false, min: 1, perItem: true },
            { name: 'featured_artists', type: 'tags', label: 'Featured Artists', required: false, placeholder: 'e.g., Artist 1, Artist 2' },
            { name: 'explicit', type: 'checkbox', label: 'Contains Explicit Content', required: false },
            { name: 'record_label', type: 'text', label: 'Record Label', required: false, placeholder: 'e.g., Bantu Records' },
            { name: 'media_type_toggle', type: 'radio', label: 'Content Type', required: true, options: ['Audio Track', 'Music Video'] }
        ],
        content_format: 'music',
        requires_chapters: false,
        requires_mood: true,
        uses_playlist: true,
        playlist_type: 'album',
        isMovieContent: false
    },
    'Podcast': {
        title: 'Podcast Episode Details',
        fields: [
            { name: 'show_title', type: 'text', label: 'Podcast Show Title', required: true, placeholder: 'e.g., Bantu Voices' },
            { name: 'season_number', type: 'number', label: 'Season Number', required: false, min: 1 },
            { name: 'episode_number', type: 'number', label: 'Episode Number', required: false, min: 1, perItem: true },
            { name: 'episode_title', type: 'text', label: 'Episode Title', required: true, placeholder: 'e.g., The Journey Begins', perItem: true },
            { name: 'guest_names', type: 'tags', label: 'Guest Names', required: false, placeholder: 'e.g., Guest 1, Guest 2' },
            { name: 'explicit', type: 'checkbox', label: 'Contains Explicit Content', required: false },
            { name: 'category', type: 'select', label: 'Category', required: true, options: ['News', 'Business', 'Technology', 'Culture', 'Education', 'Entertainment', 'Health', 'Sports'] },
            { name: 'language', type: 'select', label: 'Language', required: true, options: ['English', 'isiZulu', 'isiXhosa', 'Afrikaans', 'Sesotho', 'Setswana', 'Sepedi', 'Xitsonga', 'siSwati', 'Tshivenda', 'isiNdebele'] },
            { name: 'country', type: 'text', label: 'Country of Origin', required: true, placeholder: 'e.g., South Africa' }
        ],
        content_format: 'podcast_episode',
        requires_chapters: true,
        requires_mood: true,
        uses_playlist: true,
        playlist_type: 'podcast',
        isMovieContent: false,
        isPodcastContent: true
    },
    'Shorts': {
        title: 'Shorts Details',
        fields: [
            { name: 'audio_title', type: 'text', label: 'Audio Title', required: false, placeholder: 'e.g., Trending Sound' },
            { name: 'original_sound', type: 'checkbox', label: 'Original Sound (not trending audio)', required: false }
        ],
        content_format: 'short',
        requires_chapters: false,
        requires_mood: true,
        isMovieContent: false
    }
};

// ============================================
// GENRE-SPECIFIC DYNAMIC FORMS FUNCTIONS
// ============================================
function createFieldHTML(field) {
    if (field.type === 'text') return `<div class="form-group"><label class="form-label">${field.label} ${field.required ? '<span>*</span>' : '<span class="optional">(Optional)</span>'}</label><input type="text" id="field-${field.name}" class="form-input" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}></div>`;
    if (field.type === 'number') return `<div class="form-group"><label class="form-label">${field.label} ${field.required ? '<span>*</span>' : '<span class="optional">(Optional)</span>'}</label><input type="number" id="field-${field.name}" class="form-input" placeholder="${field.placeholder || ''}" min="${field.min || 0}" max="${field.max || ''}" ${field.required ? 'required' : ''}></div>`;
    if (field.type === 'textarea') return `<div class="form-group"><label class="form-label">${field.label} ${field.required ? '<span>*</span>' : '<span class="optional">(Optional)</span>'}</label><textarea id="field-${field.name}" class="form-input" rows="${field.rows || 3}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}></textarea></div>`;
    if (field.type === 'select') return `<div class="form-group"><label class="form-label">${field.label} ${field.required ? '<span>*</span>' : ''}</label><select id="field-${field.name}" class="form-input" ${field.required ? 'required' : ''}><option value="">Select ${field.label}</option>${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select></div>`;
    if (field.type === 'tags') return `<div class="form-group"><label class="form-label">${field.label} ${field.required ? '<span>*</span>' : '<span class="optional">(Optional)</span>'}</label><div id="field-${field.name}" class="tags-input-container-placeholder"></div></div>`;
    if (field.type === 'checkbox') return `<div class="form-group"><label style="display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="field-${field.name}" style="width:20px;height:20px"><span class="form-label" style="margin:0">${field.label}</span></label></div>`;
    if (field.type === 'radio') return `<div class="form-group"><label class="form-label">${field.label} ${field.required ? '<span>*</span>' : ''}</label><div style="display:flex;gap:15px">${field.options.map(opt => `<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="field-${field.name}" value="${opt}" ${field.required ? 'required' : ''}><span>${opt}</span></label>`).join('')}</div></div>`;
    return '';
}

function updateGenreForm(isBatchMode = false) {
    const genre = document.getElementById('content-genre').value;
    const config = genreConfig[genre];
    const container = document.getElementById('dynamic-fields-container');
    const contentDiv = document.getElementById('dynamic-fields-content');
    const moodSection = document.getElementById('mood-tags-section');
    const chaptersSection = document.getElementById('chapters-section');
    const movieSection = document.getElementById('movie-classification-section');
    const newsFields = document.getElementById('news-fields');

    container.classList.remove('active');
    moodSection.classList.remove('active');
    chaptersSection.classList.remove('active');
    movieSection.classList.remove('active');
    newsFields.classList.remove('active');

    if (!config) return;

    document.getElementById('dynamic-fields-title').innerHTML = `<i class="fas fa-layer-group"></i> ${config.title}`;
    contentDiv.innerHTML = '';

    // perItem fields (track/episode title+number) move into the batch queue
    // rows instead of the shared form when 2+ files are queued.
    const fieldsToRender = isBatchMode ? config.fields.filter(f => !f.perItem) : config.fields;
    fieldsToRender.forEach(field => {
        if (field.type === 'tags') {
            const ph = document.createElement('div');
            ph.id = `field-${field.name}`;
            ph.className = 'tags-input-container-placeholder';
            contentDiv.appendChild(ph);
            ph.appendChild(createTagsInput(field, `field-${field.name}`, []));
        } else {
            contentDiv.insertAdjacentHTML('beforeend', createFieldHTML(field));
        }
    });

    container.classList.add('active');

    if (config.requires_mood) {
        moodSection.classList.add('active');
    }

    // Chapters apply to a single file's timestamps — no per-row chapter UI
    // exists yet, so batch mode skips this section entirely rather than
    // collecting chapter data that would get wrongly applied to every item.
    if (config.requires_chapters && !isBatchMode) {
        chaptersSection.classList.add('active');
        renderChaptersList();
    }

    if (config.isMovieContent) {
        movieSection.classList.add('active');
        setupMovieGenreChips();
        setupMovieTagsInput();
    }

    updateChecklist();
}

function collectContentMetadata() {
    const genre = document.getElementById('content-genre').value;
    const config = genreConfig[genre];
    const metadata = {};
    if (!config) return metadata;
    
    if (config.isPodcastContent) {
        return collectPodcastMetadata();
    }
    
    config.fields.forEach(field => {
        const element = document.getElementById(`field-${field.name}`);
        if (!element) return;

        if (field.type === 'tags') {
            const container = element.closest('.tags-input-container') || element.querySelector('.tags-input-container');
            metadata[field.name] = container?.dataset.tags ? JSON.parse(container.dataset.tags) : [];
        } else if (field.type === 'checkbox') {
            metadata[field.name] = element.checked;
        } else if (field.type === 'radio') {
            const selected = document.querySelector(`input[name="field-${field.name}"]:checked`);
            metadata[field.name] = selected ? selected.value : null;
        } else {
            metadata[field.name] = element.value;
        }
    });

    // tempo/key_signature/is_explicit live in #tempo-group/#key-group/
    // #explicit-group with unprefixed ids (tempo/key_signature/is_explicit),
    // not the field-${name} convention the generic loop above expects, so
    // they were never collected and silently discarded on submit.
    if (genre === 'Music') {
        const tempoEl = document.getElementById('tempo');
        const keyEl = document.getElementById('key_signature');
        const explicitEl = document.getElementById('is_explicit');
        metadata.tempo = tempoEl?.value ? parseInt(tempoEl.value, 10) : null;
        metadata.key_signature = keyEl?.value || null;
        metadata.is_explicit = explicitEl?.checked || false;
    }

    return metadata;
}

function collectPodcastMetadata() {
    const genre = document.getElementById('content-genre').value;
    if (genre !== 'Podcast') return null;
    
    return {
        show_title: document.getElementById('field-show_title')?.value || null,
        season_number: document.getElementById('field-season_number')?.value ? parseInt(document.getElementById('field-season_number').value) : null,
        episode_number: document.getElementById('field-episode_number')?.value ? parseInt(document.getElementById('field-episode_number').value) : null,
        episode_title: document.getElementById('field-episode_title')?.value || null,
        guest_names: [],
        explicit: document.getElementById('field-explicit')?.checked || false,
        category: document.getElementById('field-category')?.value || null,
        language: document.getElementById('field-language')?.value || 'English',
        country: document.getElementById('field-country')?.value || 'South Africa'
    };
}

function validateGenreMetadata(isBatchMode = false) {
    const genre = document.getElementById('content-genre').value;
    const config = genreConfig[genre];
    if (!config) return true;
    
    if (config.isPodcastContent) {
        const podcastMeta = collectPodcastMetadata();
        if (!podcastMeta?.show_title) {
            showToast('Podcast show title is required', 'error');
            return false;
        }
        if (!podcastMeta?.category) {
            showToast('Podcast category is required', 'error');
            return false;
        }
        if (!podcastMeta?.language) {
            showToast('Podcast language is required', 'error');
            return false;
        }
        if (!podcastMeta?.country) {
            showToast('Country of origin is required', 'error');
            return false;
        }
        if (!selectedMood) {
            showToast('Select a mood', 'error');
            return false;
        }
        return true;
    }
    
    if (config.isMovieContent) {
        if (selectedGenres.length === 0) {
            showToast('Select at least 1 primary genre', 'error');
            return false;
        }
        if (selectedSAGenres.length === 0) {
            showToast('Select at least 1 SA genre', 'error');
            return false;
        }
        if (!selectedMood) {
            showToast('Select a mood', 'error');
            return false;
        }
        return true;
    }
    
    let isValid = true;
    for (const field of config.fields) {
        if (isBatchMode && field.perItem) continue;
        if (field.required) {
            if (field.type === 'tags') {
                const element = document.getElementById(`field-${field.name}`);
                const container = element?.closest('.tags-input-container') || element?.querySelector('.tags-input-container');
                const tags = container?.dataset.tags ? JSON.parse(container.dataset.tags) : [];
                if (tags.length === 0) {
                    isValid = false;
                    break;
                }
            } else if (field.type === 'radio') {
                const selected = document.querySelector(`input[name="field-${field.name}"]:checked`);
                if (!selected) {
                    isValid = false;
                    break;
                }
            } else {
                const element = document.getElementById(`field-${field.name}`);
                if (!element || !element.value) {
                    isValid = false;
                    break;
                }
            }
        }
    }
    return isValid;
}
