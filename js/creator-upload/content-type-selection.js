// ============================================
// MEDIA TYPE SELECTOR SETUP
// ============================================
function setupMediaTypeSelector() {
    document.querySelectorAll('.media-type-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.media-type-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedMediaType = opt.dataset.type;
            document.getElementById('shorts-info').classList.toggle('active', selectedMediaType === 'short');
            const newsFields = document.getElementById('news-fields');
            if (selectedMediaType === 'news') {
                newsFields.classList.add('active');
                const articleBody = document.getElementById('article-body');
                const readTimeInput = document.getElementById('read-time');
                if (articleBody && readTimeInput) {
                    articleBody.addEventListener('input', () => {
                        if (!readTimeInput.value || readTimeInput.value === '3') {
                            const words = articleBody.value.split(/\s+/).filter(w => w.length > 0).length;
                            readTimeInput.value = Math.max(1, Math.ceil(words / 200));
                        }
                    });
                }
            } else {
                newsFields.classList.remove('active');
            }
            if (selectedMediaFile) validateMediaFile(selectedMediaFile);
            updateButtonsState();
            updateChecklist();
        });
    });
}
