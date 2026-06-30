// ============================================
// POST-UPLOAD ACTIONS FUNCTIONS
// ============================================
function triggerConfetti() {
    const colors = ['#F59E0B', '#1D4ED8', '#10B981', '#EF4444'];
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 4000);
    }
}

window.removeMediaFile = function() {
    selectedMediaFile = null;
    extractedDuration = null;
    document.getElementById('media-file-info').style.display = 'none';
    document.getElementById('media-zone-text').textContent = 'Click or drag video/audio files here';
    document.getElementById('duration-display').style.display = 'none';
    updateButtonsState();
    updateChecklist();
};

window.openImagePicker = function() { document.getElementById('thumbnail-file-input').click(); };
window.captureCameraImage = function() { document.getElementById('camera-file-input').click(); };
window.viewContent = function() { window.location.href = 'content-library.html'; };
window.shareContent = function() {
    if (navigator.share) {
        navigator.share({ title: 'Check out my content on Bantu Stream Connect!', url: window.location.origin });
    } else {
        navigator.clipboard.writeText(window.location.origin);
        showToast('Link copied to clipboard', 'success');
    }
};
window.uploadAnother = function() {
    document.getElementById('upload-form').reset();
    selectedMediaFile = null;
    selectedThumbnailFile = null;
    extractedDuration = null;
    selectedMood = null;
    chapters = [];
    selectedGenres = [];
    selectedSAGenres = [];
    movieTags = [];
    document.getElementById('media-file-info').style.display = 'none';
    document.getElementById('thumbnail-preview').style.display = 'none';
    document.getElementById('duration-display').style.display = 'none';
    document.getElementById('success-state').classList.remove('active');
    document.getElementById('upload-form-state').style.display = 'block';
    updateGenreForm();
    updateChecklist();
    updateButtonsState();
    showToast('Ready for next upload!', 'success');
};
window.goToDashboard = function() { window.location.href = 'creator-dashboard.html'; };
