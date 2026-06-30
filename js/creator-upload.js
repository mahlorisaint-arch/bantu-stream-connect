// ============================================
// CREATOR UPLOAD - MAIN INITIALIZATION
// Contains: Variables, Helpers, Tags, Music Features, Auth, Global Functions, Init
// ============================================

// ============================================
// GLOBAL VARIABLES
// ============================================
let selectedMediaFile = null, selectedThumbnailFile = null, currentUserId = null, currentSession = null;
let isUploading = false, selectedMediaType = 'regular', extractedDuration = null, currentXhr = null;
let selectedMood = null, chapters = [];
let uploadStartTime = 0, uploadStartBytes = 0, lastLoadedBytes = 0, lastUpdateTime = 0;
let selectedGenres = [], selectedSAGenres = [], movieTags = [];

// DOM Elements
const loadingScreen = document.getElementById('loading'), app = document.getElementById('app');
const authModal = document.getElementById('auth-modal');
const publishBtn = document.getElementById('publish-btn'), saveDraftBtn = document.getElementById('save-draft-btn');
const progressSection = document.getElementById('upload-progress'), progressFill = document.getElementById('progress-fill');
const progressPercentage = document.getElementById('progress-percentage'), progressText = document.getElementById('progress-text');
const progressSpeed = document.getElementById('progress-speed'), progressEta = document.getElementById('progress-eta');
const uploadFormState = document.getElementById('upload-form-state'), processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const processingMessage = document.getElementById('processing-message');

// ============================================
// HELPER FUNCTIONS
// ============================================
function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'info' ? 'info-circle' : 'exclamation-triangle'}"></i> ${message}`;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds) {
    if (!seconds && seconds !== 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeForSupabase(obj) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === "" || value === undefined) {
            sanitized[key] = null;
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

function cleanContentMetadata(rawMetadata) {
    return {
        track_title: rawMetadata.track_title || null,
        artist_name: rawMetadata.artist_name || null,
        album_title: rawMetadata.album_title || null,
        track_number: rawMetadata.track_number ? parseInt(rawMetadata.track_number) : null,
        featured_artists: Array.isArray(rawMetadata.featured_artists) ? rawMetadata.featured_artists : [],
        explicit: rawMetadata.explicit || false,
        record_label: rawMetadata.record_label || null
    };
}

// ============================================
// TAGS INPUT COMPONENT
// ============================================
function createTagsInput(field, containerId, tagsArray) {
    const container = document.createElement('div');
    container.className = 'tags-input-container';
    container.innerHTML = `<div class="tags-list" id="tags-list-${field.name}"></div><input type="text" class="tags-input" placeholder="${field.placeholder || 'Type and press Enter'}" id="tags-input-${field.name}">`;
    const tagsList = container.querySelector(`#tags-list-${field.name}`);
    const input = container.querySelector(`#tags-input-${field.name}`);
    
    function renderTags() {
        tagsList.innerHTML = tagsArray.map(tag => `<span class="tag">${escapeHtml(tag)}<i class="fas fa-times"></i></span>`).join('');
        tagsList.querySelectorAll('.tag i').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagToRemove = icon.parentElement.textContent.trim();
                const index = tagsArray.indexOf(tagToRemove);
                if (index > -1) tagsArray.splice(index, 1);
                renderTags();
            });
        });
    }
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = input.value.trim();
            if (value && !tagsArray.includes(value)) {
                tagsArray.push(value);
                renderTags();
                input.value = '';
            }
        }
    });
    
    input.addEventListener('blur', () => {
        if (input.value.trim()) {
            const value = input.value.trim();
            if (!tagsArray.includes(value)) {
                tagsArray.push(value);
                renderTags();
            }
            input.value = '';
        }
    });
    
    renderTags();
    return container;
}

// ============================================
// MUSIC GENRE/TAG LOADING FUNCTIONS
// ============================================
async function loadGenresForUpload() {
    try {
        const { data: genres, error } = await window.supabaseClient
            .from('genres')
            .select('id, name, slug, parent_genre_id')
            .eq('is_active', true)
            .order('display_order', { ascending: true });
        
        if (error) throw error;
        
        const parentGenres = genres.filter(g => !g.parent_genre_id);
        const subGenres = genres.filter(g => g.parent_genre_id);
        const genreSelect = document.getElementById('music-genre');
        
        if (genreSelect) {
            genreSelect.innerHTML = '<option value="">Select genre...</option>';
            parentGenres.forEach(genre => {
                genreSelect.innerHTML += `<option value="${genre.id}" data-slug="${genre.slug}">${genre.name}</option>`;
            });
            
            genreSelect.addEventListener('change', async (e) => {
                const genreId = e.target.value;
                const subgenreContainer = document.getElementById('subgenre-container');
                const subgenreSelect = document.getElementById('music-subgenre');
                
                if (genreId && subgenreSelect) {
                    const relevantSubgenres = subGenres.filter(sg => sg.parent_genre_id == genreId);
                    if (relevantSubgenres.length > 0) {
                        subgenreSelect.innerHTML = '<option value="">Select subgenre...</option>';
                        relevantSubgenres.forEach(sg => {
                            subgenreSelect.innerHTML += `<option value="${sg.id}">${sg.name}</option>`;
                        });
                        subgenreContainer.style.display = 'block';
                    } else {
                        subgenreContainer.style.display = 'none';
                    }
                } else {
                    subgenreContainer.style.display = 'none';
                }
            });
        }
        
        return { parentGenres, subGenres };
    } catch (error) {
        console.error('Error loading genres:', error);
        return { parentGenres: [], subGenres: [] };
    }
}

async function loadTagsForUpload() {
    try {
        const { data: tags, error } = await window.supabaseClient
            .from('tags')
            .select('id, name, tag_type')
            .eq('is_active', true)
            .in('tag_type', ['language', 'mood', 'city'])
            .order('tag_type', { ascending: true })
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        const tagsByType = {
            language: tags.filter(t => t.tag_type === 'language'),
            mood: tags.filter(t => t.tag_type === 'mood'),
            city: tags.filter(t => t.tag_type === 'city')
        };
        
        const tagContainer = document.getElementById('tag-buttons');
        if (tagContainer) {
            tagContainer.innerHTML = '';
            
            if (tagsByType.language.length > 0) {
                tagContainer.innerHTML += `<div class="tag-section"><strong><i class="fas fa-language"></i> Language</strong><div class="tag-group">`;
                tagsByType.language.forEach(tag => {
                    tagContainer.innerHTML += `<button type="button" class="tag-btn" data-tag-id="${tag.id}" data-tag-name="${tag.name}" data-tag-type="language">${tag.name}</button>`;
                });
                tagContainer.innerHTML += `</div></div>`;
            }
            
            if (tagsByType.mood.length > 0) {
                tagContainer.innerHTML += `<div class="tag-section"><strong><i class="fas fa-face-smile"></i> Mood</strong><div class="tag-group">`;
                tagsByType.mood.forEach(tag => {
                    tagContainer.innerHTML += `<button type="button" class="tag-btn" data-tag-id="${tag.id}" data-tag-name="${tag.name}" data-tag-type="mood">${tag.name}</button>`;
                });
                tagContainer.innerHTML += `</div></div>`;
            }
            
            if (tagsByType.city.length > 0) {
                tagContainer.innerHTML += `<div class="tag-section"><strong><i class="fas fa-city"></i> City/Origin</strong><div class="tag-group">`;
                tagsByType.city.forEach(tag => {
                    tagContainer.innerHTML += `<button type="button" class="tag-btn" data-tag-id="${tag.id}" data-tag-name="${tag.name}" data-tag-type="city">${tag.name}</button>`;
                });
                tagContainer.innerHTML += `</div></div>`;
            }
            
            document.querySelectorAll('.tag-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    btn.classList.toggle('selected');
                });
            });
        }
        
        return tags;
    } catch (error) {
        console.error('Error loading tags:', error);
        return [];
    }
}

function getSelectedTags() {
    const selected = [];
    document.querySelectorAll('.tag-btn.selected').forEach(btn => {
        selected.push({
            tag_id: btn.dataset.tagId,
            name: btn.dataset.tagName,
            type: btn.dataset.tagType
        });
    });
    return selected;
}

function setupContentFormatToggle() {
    const formatSelect = document.getElementById('content_format');
    const musicGenreGroup = document.getElementById('music-genre-group');
    const musicTagsGroup = document.getElementById('music-tags-group');
    const tempoGroup = document.getElementById('tempo-group');
    const keyGroup = document.getElementById('key-group');
    const explicitGroup = document.getElementById('explicit-group');
    
    if (!formatSelect) return;
    
    function toggleMusicFields() {
        const selectedFormat = formatSelect.value;
        const isMusic = selectedFormat === 'music' || selectedFormat === 'music_video';
        if (musicGenreGroup) musicGenreGroup.style.display = isMusic ? 'block' : 'none';
        if (musicTagsGroup) musicTagsGroup.style.display = isMusic ? 'block' : 'none';
        if (tempoGroup) tempoGroup.style.display = isMusic ? 'block' : 'none';
        if (keyGroup) keyGroup.style.display = isMusic ? 'block' : 'none';
        if (explicitGroup) explicitGroup.style.display = isMusic ? 'block' : 'none';
    }
    
    formatSelect.addEventListener('change', toggleMusicFields);
    toggleMusicFields();
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================
async function checkAuthentication() {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session?.user) {
        currentSession = session;
        currentUserId = session.user.id;
        return session.user;
    }
    return null;
}

// ============================================
// INITIALIZATION
// ============================================
async function initMusicUploadExtensions() {
    await loadGenresForUpload();
    await loadTagsForUpload();
    setupContentFormatToggle();
}

async function initialize() {
    loadingScreen.style.display = 'flex';
    app.style.display = 'none';
    
    const user = await checkAuthentication();
    if (!user) authModal.classList.add('active');
    
    setupMediaTypeSelector();
    setupMediaUpload();
    setupThumbnailUpload();
    setupListeners();
    updateGenreForm();
    updateButtonsState();
    updateChecklist();
    loadDraftFromLocalStorage();
    await initMusicUploadExtensions();
    
    loadingScreen.style.display = 'none';
    app.style.display = 'block';
}

// Initialize the app
initialize();

// Supabase client initialization
if (!window.supabaseClient) {
    window.supabaseClient = supabase.createClient(
        'https://ydnxqnbjoshvxteevemc.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
    );
}
