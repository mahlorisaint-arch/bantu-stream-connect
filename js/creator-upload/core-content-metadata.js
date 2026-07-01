// ============================================
// CORE CONTENT METADATA FUNCTIONS
// ============================================
function updateButtonsState() {
    const title = document.getElementById('content-title');
    const desc = document.getElementById('content-description');
    const genre = document.getElementById('content-genre');
    
    const titleVal = title ? title.value.trim() : '';
    const descVal = desc ? desc.value.trim() : '';
    const genreVal = genre ? genre.value : '';
    
    const isNews = selectedMediaType === 'news';
    const isShortValid = selectedMediaType !== 'short' || (extractedDuration !== null && extractedDuration <= 60);
    const hasRequiredDuration = selectedMediaType !== 'short' || isShortValid;
    
    // Safely check if validateGenreMetadata exists
    let metadataValid = true;
    if (typeof validateGenreMetadata === 'function') {
        metadataValid = isNews ? true : validateGenreMetadata();
    }
    
    if (saveDraftBtn) {
        saveDraftBtn.disabled = !titleVal || isUploading || !currentUserId;
    }
    
    if (publishBtn) {
        publishBtn.disabled = !titleVal || !descVal || (!isNews && !selectedMediaFile) || isUploading || !currentUserId || !hasRequiredDuration || !genreVal || !metadataValid;
    }
    
    if (isUploading) {
        if (publishBtn) {
            publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
        }
        if (saveDraftBtn) {
            saveDraftBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }
    } else {
        if (publishBtn) {
            publishBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publish Content';
        }
        if (saveDraftBtn) {
            saveDraftBtn.innerHTML = '<i class="fas fa-save"></i> Save Draft';
        }
    }
}

function saveDraftToLocalStorage() {
    if (!currentUserId) return;
    
    const title = document.getElementById('content-title');
    const desc = document.getElementById('content-description');
    const genre = document.getElementById('content-genre');
    const newsSource = document.getElementById('news-source');
    const newsCategory = document.getElementById('news-category');
    const readTime = document.getElementById('read-time');
    const isBreaking = document.getElementById('is-breaking');
    const articleBody = document.getElementById('article-body');
    
    const draft = {
        title: title ? title.value : '',
        description: desc ? desc.value : '',
        genre: genre ? genre.value : '',
        mediaType: selectedMediaType,
        hasMedia: !!selectedMediaFile,
        mediaName: selectedMediaFile?.name || null,
        hasThumbnail: !!selectedThumbnailFile,
        selectedMood: selectedMood,
        chapters: chapters,
        selectedGenres: [...selectedGenres],
        selectedSAGenres: [...selectedSAGenres],
        movieTags: [...movieTags],
        newsSource: newsSource ? newsSource.value : '',
        newsCategory: newsCategory ? newsCategory.value : '',
        readTime: readTime ? readTime.value : '3',
        isBreaking: isBreaking ? isBreaking.checked : false,
        articleBody: articleBody ? articleBody.value : ''
    };
    localStorage.setItem(`draft_${currentUserId}`, JSON.stringify(draft));
}

function loadDraftFromLocalStorage() {
    if (!currentUserId) return;
    const draftStr = localStorage.getItem(`draft_${currentUserId}`);
    if (draftStr) {
        try {
            const draft = JSON.parse(draftStr);
            const title = document.getElementById('content-title');
            const desc = document.getElementById('content-description');
            const genre = document.getElementById('content-genre');
            
            if (title) title.value = draft.title || '';
            if (desc) desc.value = draft.description || '';
            if (draft.genre && genre) {
                genre.value = draft.genre;
                if (typeof updateGenreForm === 'function') updateGenreForm();
            }
            if (draft.selectedMood) {
                const moodEl = document.querySelector(`.mood-option[data-mood="${draft.selectedMood}"]`);
                if (moodEl) moodEl.click();
            }
            if (draft.chapters) {
                chapters = draft.chapters;
                if (typeof renderChaptersList === 'function') renderChaptersList();
            }
            if (draft.selectedGenres) selectedGenres = [...draft.selectedGenres];
            if (draft.selectedSAGenres) selectedSAGenres = [...draft.selectedSAGenres];
            if (draft.movieTags) movieTags = [...draft.movieTags];
            
            const newsSource = document.getElementById('news-source');
            const newsCategory = document.getElementById('news-category');
            const readTime = document.getElementById('read-time');
            const isBreaking = document.getElementById('is-breaking');
            const articleBody = document.getElementById('article-body');
            
            if (newsSource) newsSource.value = draft.newsSource || '';
            if (newsCategory) newsCategory.value = draft.newsCategory || '';
            if (readTime) readTime.value = draft.readTime || '3';
            if (isBreaking) isBreaking.checked = draft.isBreaking || false;
            if (articleBody) articleBody.value = draft.articleBody || '';
            
            if (typeof updateChecklist === 'function') updateChecklist();
            if (typeof updateButtonsState === 'function') updateButtonsState();
            if (draft.hasMedia && typeof showToast === 'function') {
                showToast(`Draft recovered: ${draft.mediaName}`, 'success');
            }
        } catch (e) {
            console.warn('Failed to load draft:', e);
        }
    }
}

function setupListeners() {
    const form = document.getElementById('upload-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isUploading && typeof uploadContent === 'function') {
                await uploadContent(false);
            }
        });
    }
    
    const saveDraftBtnEl = document.getElementById('save-draft-btn');
    if (saveDraftBtnEl) {
        saveDraftBtnEl.addEventListener('click', () => {
            if (!isUploading && typeof uploadContent === 'function') uploadContent(true);
        });
    }
    
    const titleInput = document.getElementById('content-title');
    const descInput = document.getElementById('content-description');
    
    if (titleInput) {
        titleInput.addEventListener('input', () => {
            if (typeof updateButtonsState === 'function') updateButtonsState();
            if (typeof updateChecklist === 'function') updateChecklist();
            saveDraftToLocalStorage();
        });
    }
    
    if (descInput) {
        descInput.addEventListener('input', () => {
            if (typeof updateButtonsState === 'function') updateButtonsState();
            if (typeof updateChecklist === 'function') updateChecklist();
            saveDraftToLocalStorage();
        });
    }
    
    const genreSelect = document.getElementById('content-genre');
    if (genreSelect) {
        genreSelect.addEventListener('change', () => {
            selectedGenres = [];
            selectedSAGenres = [];
            movieTags = [];
            if (typeof updateGenreForm === 'function') updateGenreForm();
            if (typeof updateButtonsState === 'function') updateButtonsState();
            if (typeof updateChecklist === 'function') updateChecklist();
            saveDraftToLocalStorage();
        });
    }
    
    const authLoginBtn = document.getElementById('auth-login-btn');
    if (authLoginBtn) {
        const newBtn = authLoginBtn.cloneNode(true);
        authLoginBtn.parentNode.replaceChild(newBtn, authLoginBtn);
        newBtn.addEventListener('click', () => {
            window.location.href = `login.html?redirect=${encodeURIComponent('creator-upload.html')}`;
        });
    }
    
    const authCancelBtn = document.getElementById('auth-cancel-btn');
    if (authCancelBtn) {
        const newBtn = authCancelBtn.cloneNode(true);
        authCancelBtn.parentNode.replaceChild(newBtn, authCancelBtn);
        newBtn.addEventListener('click', () => {
            const modal = document.getElementById('auth-modal');
            if (modal) modal.classList.remove('active');
        });
    }
    
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.addEventListener('click', () => window.history.back());
    }
    
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
        const newBtn = profileBtn.cloneNode(true);
        profileBtn.parentNode.replaceChild(newBtn, profileBtn);
        newBtn.addEventListener('click', () => {
            window.location.href = currentUserId ? 'profile.html' : `login.html?redirect=${encodeURIComponent('creator-upload.html')}`;
        });
    }
    
    document.querySelectorAll('.mood-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.mood-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedMood = opt.dataset.mood;
            saveDraftToLocalStorage();
        });
    });
    
    document.addEventListener('change', (e) => {
        if (e.target.id && e.target.id.startsWith('field-')) {
            if (typeof updateButtonsState === 'function') updateButtonsState();
            if (typeof updateChecklist === 'function') updateChecklist();
            saveDraftToLocalStorage();
        }
    });
    
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    
    if (searchBtn && searchModal) {
        searchBtn.addEventListener('click', () => {
            searchModal.classList.add('active');
            const input = document.getElementById('search-input');
            if (input) setTimeout(() => input.focus(), 100);
        });
    }
    
    if (closeSearchBtn && searchModal) {
        closeSearchBtn.addEventListener('click', () => searchModal.classList.remove('active'));
    }
    
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) searchModal.classList.remove('active');
        });
    }
    
    // ============================================
    // NOTIFICATIONS - REMOVED because shared-components.js handles it globally
    // The notifications button and panel are managed by shared-components.js
    // ============================================
    // The following code has been removed to prevent conflicts with shared-components.js:
    // - notificationsBtn click handler
    // - closeNotifications click handler
    // These are now handled by the global shared-components.js
}

// Make functions globally available
window.saveDraftToLocalStorage = saveDraftToLocalStorage;
window.loadDraftFromLocalStorage = loadDraftFromLocalStorage;
window.updateButtonsState = updateButtonsState;
window.setupListeners = setupListeners;
