// ============================================
// CHAPTER MARKERS FUNCTIONS
// ============================================
function renderChaptersList() {
    const container = document.getElementById('chapters-list');
    if (!container) return;
    
    container.innerHTML = chapters.map((chapter, index) => `
        <div class="chapter-item">
            <input type="text" class="chapter-time" placeholder="MM:SS" value="${chapter.time}" data-index="${index}" data-field="time">
            <input type="text" class="chapter-title" placeholder="Chapter title" value="${escapeHtml(chapter.title)}" data-index="${index}" data-field="title">
            <button type="button" class="remove-chapter" data-index="${index}"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
    
    container.querySelectorAll('.chapter-time').forEach(inp => {
        inp.addEventListener('change', (e) => { chapters[parseInt(e.target.dataset.index)].time = e.target.value; });
    });
    
    container.querySelectorAll('.chapter-title').forEach(inp => {
        inp.addEventListener('change', (e) => { chapters[parseInt(e.target.dataset.index)].title = e.target.value; });
    });
    
    container.querySelectorAll('.remove-chapter').forEach(btn => {
        btn.addEventListener('click', (e) => { chapters.splice(parseInt(e.target.dataset.index), 1); renderChaptersList(); });
    });
}

function addChapter() { chapters.push({ time: '00:00', title: 'New Chapter' }); renderChaptersList(); }
document.getElementById('add-chapter-btn')?.addEventListener('click', addChapter);
