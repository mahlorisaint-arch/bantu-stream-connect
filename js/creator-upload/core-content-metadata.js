// ============================================
// CORE CONTENT METADATA FUNCTIONS
// ============================================
function updateButtonsState() {
    const title = document.getElementById('content-title').value.trim();
    const desc = document.getElementById('content-description').value.trim();
    const genre = document.getElementById('content-genre').value;
    const isNews = selectedMediaType === 'news';
    const isShortValid = selectedMediaType !== 'short' || (extractedDuration !== null && extractedDuration <= 60);
    const hasRequiredDuration = selectedMediaType !== 'short' || isShortValid;
    const metadataValid = isNews ? true : validateGenreMetadata();
    
    saveDraftBtn.disabled = !title || isUploading || !currentUserId;
    publishBtn.disabled = !title || !desc || (!isNews && !selectedMediaFile) || isUploading || !currentUserId || !hasRequiredDuration || !genre || !metadataValid;
    
    if (isUploading) {
        publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
        saveDraftBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    } else {
        publishBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publish Content';
        saveDraftBtn.innerHTML = '<i class="fas fa-save"></i> Save Draft';
    }
}

function saveDraftToLocalStorage() {
    if (!currentUserId) return;
    const draft = {
        title: document.getElementById('content-title').value,
        description: document.getElementById('content-description').value,
        genre: document.getElementById('content-genre').value,
        mediaType: selectedMediaType,
        hasMedia: !!selectedMediaFile,
        mediaName: selectedMediaFile?.name || null,
        hasThumbnail: !!selectedThumbnailFile,
        selectedMood: selectedMood,
        chapters: chapters,
        selectedGenres: [...selectedGenres],
        selectedSAGenres: [...selectedSAGenres],
        movieTags: [...movieTags],
        newsSource: document.getElementById('news-source')?.value || '',
        newsCategory: document.getElementById('news-category')?.value || '',
        readTime: document.getElementById('read-time')?.value || '3',
        isBreaking: document.getElementById('is-breaking')?.checked || false,
        articleBody: document.getElementById('article-body')?.value || ''
    };
    localStorage.setItem(`draft_${currentUserId}`, JSON.stringify(draft));
}

function loadDraftFromLocalStorage() {
    if (!currentUserId) return;
    const draftStr = localStorage.getItem(`draft_${currentUserId}`);
    if (draftStr) {
        const draft = JSON.parse(draftStr);
        document.getElementById('content-title').value = draft.title || '';
        document.getElementById('content-description').value = draft.description || '';
        if (draft.genre) {
            document.getElementById('content-genre').value = draft.genre;
            updateGenreForm();
        }
        if (draft.selectedMood) {
            const moodEl = document.querySelector(`.mood-option[data-mood="${draft.selectedMood}"]`);
            if (moodEl) moodEl.click();
        }
        if (draft.chapters) {
            chapters = draft.chapters;
            renderChaptersList();
        }
        if (draft.selectedGenres) selectedGenres = [...draft.selectedGenres];
        if (draft.selectedSAGenres) selectedSAGenres = [...draft.selectedSAGenres];
        if (draft.movieTags) movieTags = [...draft.movieTags];
        if (draft.newsSource) document.getElementById('news-source').value = draft.newsSource;
        if (draft.newsCategory) document.getElementById('news-category').value = draft.newsCategory;
        if (draft.readTime) document.getElementById('read-time').value = draft.readTime;
        if (draft.isBreaking) document.getElementById('is-breaking').checked = draft.isBreaking;
        if (draft.articleBody) document.getElementById('article-body').value = draft.articleBody;
        updateChecklist();
        updateButtonsState();
        if (draft.hasMedia) showToast(`Draft recovered: ${draft.mediaName}`, 'success');
    }
}

function setupListeners() {
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isUploading) {
            await uploadContent(false);
        }
    });
    
    document.getElementById('save-draft-btn').addEventListener('click', () => {
        if (!isUploading) uploadContent(true);
    });
    
    ['content-title', 'content-description'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            updateButtonsState();
            updateChecklist();
            saveDraftToLocalStorage();
        });
    });
    
    document.getElementById('content-genre').addEventListener('change', () => {
        selectedGenres = [];
        selectedSAGenres = [];
        movieTags = [];
        updateGenreForm();
        updateButtonsState();
        updateChecklist();
        saveDraftToLocalStorage();
    });
    
    document.getElementById('auth-login-btn').addEventListener('click', () => {
        window.location.href = `login.html?redirect=${encodeURIComponent('creator-upload.html')}`;
    });
    
    document.getElementById('auth-cancel-btn').addEventListener('click', () => authModal.classList.remove('active'));
    document.getElementById('back-btn').addEventListener('click', () => window.history.back());
    document.getElementById('profile-btn').addEventListener('click', () => {
        window.location.href = currentUserId ? 'profile.html' : `login.html?redirect=${encodeURIComponent('creator-upload.html')}`;
    });
    
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
            updateButtonsState();
            updateChecklist();
            saveDraftToLocalStorage();
        }
    });
    
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    if (searchBtn && searchModal) {
        searchBtn.addEventListener('click', () => searchModal.classList.add('active'));
        closeSearchBtn.addEventListener('click', () => searchModal.classList.remove('active'));
        searchModal.addEventListener('click', (e) => { if (e.target === searchModal) searchModal.classList.remove('active'); });
    }
    
    const notificationsBtn = document.getElementById('notifications-btn');
    const notificationsPanel = document.getElementById('notifications-panel');
    const closeNotifications = document.getElementById('close-notifications');
    if (notificationsBtn && notificationsPanel) {
        notificationsBtn.addEventListener('click', () => notificationsPanel.classList.add('active'));
        closeNotifications.addEventListener('click', () => notificationsPanel.classList.remove('active'));
    }
}
