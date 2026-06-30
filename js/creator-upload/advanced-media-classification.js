// ============================================
// ADVANCED MEDIA CLASSIFICATION FUNCTIONS
// ============================================
function setupMovieGenreChips() {
    document.querySelectorAll('#primary-genres-chips .genre-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            const genre = chip.dataset.genre;
            if (chip.classList.contains('selected')) {
                if (!selectedGenres.includes(genre)) selectedGenres.push(genre);
            } else {
                selectedGenres = selectedGenres.filter(g => g !== genre);
            }
            updateChecklist();
        });
    });
    
    document.querySelectorAll('#sa-genres-chips .sa-genre-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            const saGenre = chip.dataset.saGenre;
            if (chip.classList.contains('selected')) {
                if (!selectedSAGenres.includes(saGenre)) selectedSAGenres.push(saGenre);
            } else {
                selectedSAGenres = selectedSAGenres.filter(g => g !== saGenre);
            }
            updateChecklist();
        });
    });
}

function setupMovieTagsInput() {
    const tagsList = document.getElementById('movie-tags-list');
    const input = document.getElementById('movie-tags-input');
    
    function renderMovieTags() {
        tagsList.innerHTML = movieTags.map(tag => `<span class="tag">${escapeHtml(tag)}<i class="fas fa-times"></i></span>`).join('');
        tagsList.querySelectorAll('.tag i').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagToRemove = icon.parentElement.textContent.trim();
                const index = movieTags.indexOf(tagToRemove);
                if (index > -1) {
                    movieTags.splice(index, 1);
                    renderMovieTags();
                }
            });
        });
    }
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = input.value.trim();
            if (value && !movieTags.includes(value)) {
                movieTags.push(value);
                renderMovieTags();
                input.value = '';
            }
        }
    });
    
    input.addEventListener('blur', () => {
        if (input.value.trim()) {
            const value = input.value.trim();
            if (!movieTags.includes(value)) {
                movieTags.push(value);
                renderMovieTags();
            }
            input.value = '';
        }
    });
    
    renderMovieTags();
}

function collectMovieMetadata() {
    return {
        genres: [...selectedGenres],
        sa_genres: [...selectedSAGenres],
        moods: selectedMood ? [selectedMood] : [],
        tags: [...movieTags],
        language: document.getElementById('movie-language')?.value || 'English',
        is_bantu_original: document.getElementById('is-bantu-original')?.checked || false
    };
}
