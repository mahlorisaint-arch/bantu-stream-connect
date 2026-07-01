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
const loadingScreen = document.getElementById('loading');
const app = document.getElementById('app');
const authModal = document.getElementById('auth-modal');
const publishBtn = document.getElementById('publish-btn');
const saveDraftBtn = document.getElementById('save-draft-btn');
const progressSection = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const progressPercentage = document.getElementById('progress-percentage');
const progressText = document.getElementById('progress-text');
const progressSpeed = document.getElementById('progress-speed');
const progressEta = document.getElementById('progress-eta');
const uploadFormState = document.getElementById('upload-form-state');
const processingState = document.getElementById('processing-state');
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
        // Check if supabaseClient is available
        if (!window.supabaseClient) {
            console.warn('Supabase client not available for loading genres');
            return { parentGenres: [], subGenres: [] };
        }
        
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
        // Check if supabaseClient is available
        if (!window.supabaseClient) {
            console.warn('Supabase client not available for loading tags');
            return [];
        }
        
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
// AUTHENTICATION FUNCTIONS - FIXED
// ============================================
async function getSupabaseClient() {
    // Try to get the client from various sources
    if (window.supabaseClient && typeof window.supabaseClient.auth !== 'undefined') {
        return window.supabaseClient;
    }
    
    // Try supabaseAuth (from AuthHelper)
    if (window.supabaseAuth && typeof window.supabaseAuth.auth !== 'undefined') {
        window.supabaseClient = window.supabaseAuth;
        return window.supabaseAuth;
    }
    
    // Try window.supabase (from the CDN script)
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        // Create client if it doesn't exist
        if (!window.supabaseClient) {
            window.supabaseClient = window.supabase.createClient(
                'https://ydnxqnbjoshvxteevemc.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
            );
        }
        return window.supabaseClient;
    }
    
    // If still not available, create a new client
    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        window.supabaseClient = supabase.createClient(
            'https://ydnxqnbjoshvxteevemc.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
        );
        return window.supabaseClient;
    }
    
    console.error('❌ [CREATOR-UPLOAD] No Supabase client available');
    return null;
}

async function checkAuthentication() {
    try {
        const client = await getSupabaseClient();
        if (!client) return null;
        
        const { data: { session } } = await client.auth.getSession();
        if (session?.user) {
            currentSession = session;
            currentUserId = session.user.id;
            return session.user;
        }
        return null;
    } catch (error) {
        console.warn('⚠️ Authentication check failed:', error.message);
        return null;
    }
}

// ============================================
// SETUP FUNCTIONS (These are defined in the section files)
// ============================================

// ============================================
// INITIALIZATION - SKELETON FIRST THEN LOAD
// ============================================
async function initMusicUploadExtensions() {
    await loadGenresForUpload();
    await loadTagsForUpload();
    setupContentFormatToggle();
}

async function initialize() {
    console.log('🚀 Initializing Creator Upload...');
    
    // Show skeleton/loading state
    loadingScreen.style.display = 'flex';
    app.style.display = 'none';
    
    try {
        // STEP 1: Get Supabase client first
        const client = await getSupabaseClient();
        if (!client) {
            console.warn('⚠️ Supabase client not available, some features may not work');
        }
        
        // STEP 2: Check authentication
        const user = await checkAuthentication();
        if (!user) {
            // Show auth modal but don't block loading
            if (authModal) authModal.classList.add('active');
            console.log('👤 User not authenticated, showing login prompt');
        } else {
            console.log('👤 User authenticated:', user.email);
        }
        
        // STEP 3: Setup UI (these functions should be defined in section files)
        // Check if each function exists before calling
        if (typeof setupMediaTypeSelector === 'function') {
            setupMediaTypeSelector();
        } else {
            console.warn('⚠️ setupMediaTypeSelector not defined');
        }
        
        if (typeof setupMediaUpload === 'function') {
            setupMediaUpload();
        } else {
            console.warn('⚠️ setupMediaUpload not defined');
        }
        
        if (typeof setupThumbnailUpload === 'function') {
            setupThumbnailUpload();
        } else {
            console.warn('⚠️ setupThumbnailUpload not defined');
        }
        
        if (typeof setupListeners === 'function') {
            setupListeners();
        } else {
            console.warn('⚠️ setupListeners not defined');
        }
        
        if (typeof updateGenreForm === 'function') {
            updateGenreForm();
        } else {
            console.warn('⚠️ updateGenreForm not defined');
        }
        
        if (typeof updateButtonsState === 'function') {
            updateButtonsState();
        } else {
            console.warn('⚠️ updateButtonsState not defined');
        }
        
        if (typeof updateChecklist === 'function') {
            updateChecklist();
        } else {
            console.warn('⚠️ updateChecklist not defined');
        }
        
        if (typeof loadDraftFromLocalStorage === 'function') {
            loadDraftFromLocalStorage();
        } else {
            console.warn('⚠️ loadDraftFromLocalStorage not defined');
        }
        
        // STEP 4: Load music extensions
        await initMusicUploadExtensions();
        
        // STEP 5: Setup profile button for navigation
        const profileBtn = document.getElementById('profile-btn');
        if (profileBtn) {
            const newProfileBtn = profileBtn.cloneNode(true);
            profileBtn.parentNode.replaceChild(newProfileBtn, profileBtn);
            newProfileBtn.addEventListener('click', () => {
                window.location.href = currentUserId ? 'profile.html' : `login.html?redirect=${encodeURIComponent('creator-upload.html')}`;
            });
        }
        
        // STEP 6: Setup back button
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => window.history.back());
        }
        
        // STEP 7: Setup auth buttons
        const authLoginBtn = document.getElementById('auth-login-btn');
        if (authLoginBtn) {
            authLoginBtn.addEventListener('click', () => {
                window.location.href = `login.html?redirect=${encodeURIComponent('creator-upload.html')}`;
            });
        }
        
        const authCancelBtn = document.getElementById('auth-cancel-btn');
        if (authCancelBtn) {
            authCancelBtn.addEventListener('click', () => {
                if (authModal) authModal.classList.remove('active');
            });
        }
        
        console.log('✅ Creator Upload initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing creator upload:', error);
        // Show error but don't break the page
        if (showToast) {
            showToast('Some features may not work properly. Please refresh the page.', 'warning');
        }
    }
    
    // Hide loading screen and show app
    loadingScreen.style.display = 'none';
    app.style.display = 'block';
}

// ============================================
// GLOBAL FUNCTIONS - These are referenced in HTML
// ============================================
window.removeMediaFile = function() {
    if (typeof removeMediaFile === 'function') {
        removeMediaFile();
    } else {
        selectedMediaFile = null;
        extractedDuration = null;
        const fileInfo = document.getElementById('media-file-info');
        const zoneText = document.getElementById('media-zone-text');
        const durationDisplay = document.getElementById('duration-display');
        if (fileInfo) fileInfo.style.display = 'none';
        if (zoneText) zoneText.textContent = 'Click or drag video/audio files here';
        if (durationDisplay) durationDisplay.style.display = 'none';
        if (typeof updateButtonsState === 'function') updateButtonsState();
        if (typeof updateChecklist === 'function') updateChecklist();
    }
};

window.openImagePicker = function() {
    const input = document.getElementById('thumbnail-file-input');
    if (input) input.click();
};

window.captureCameraImage = function() {
    const input = document.getElementById('camera-file-input');
    if (input) input.click();
};

window.viewContent = function() {
    window.location.href = 'content-library.html';
};

window.shareContent = function() {
    if (navigator.share) {
        navigator.share({ title: 'Check out my content on Bantu Stream Connect!', url: window.location.origin });
    } else {
        navigator.clipboard.writeText(window.location.origin);
        if (typeof showToast === 'function') {
            showToast('Link copied to clipboard', 'success');
        }
    }
};

window.uploadAnother = function() {
    const form = document.getElementById('upload-form');
    if (form) form.reset();
    selectedMediaFile = null;
    selectedThumbnailFile = null;
    extractedDuration = null;
    selectedMood = null;
    chapters = [];
    selectedGenres = [];
    selectedSAGenres = [];
    movieTags = [];
    
    const fileInfo = document.getElementById('media-file-info');
    const thumbPreview = document.getElementById('thumbnail-preview');
    const durationDisplay = document.getElementById('duration-display');
    const successStateEl = document.getElementById('success-state');
    const formState = document.getElementById('upload-form-state');
    
    if (fileInfo) fileInfo.style.display = 'none';
    if (thumbPreview) thumbPreview.style.display = 'none';
    if (durationDisplay) durationDisplay.style.display = 'none';
    if (successStateEl) successStateEl.classList.remove('active');
    if (formState) formState.style.display = 'block';
    
    if (typeof updateGenreForm === 'function') updateGenreForm();
    if (typeof updateChecklist === 'function') updateChecklist();
    if (typeof updateButtonsState === 'function') updateButtonsState();
    
    if (typeof showToast === 'function') {
        showToast('Ready for next upload!', 'success');
    }
};

window.goToDashboard = function() {
    window.location.href = 'creator-dashboard.html';
};

// ============================================
// Supabase client initialization fallback
// ============================================
if (!window.supabaseClient) {
    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        window.supabaseClient = supabase.createClient(
            'https://ydnxqnbjoshvxteevemc.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
        );
        console.log('🔧 [CREATOR-UPLOAD] Created Supabase client fallback');
    }
}

// ============================================
// START INITIALIZATION
// ============================================
// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    // DOM is already ready, start immediately
    initialize();
}

console.log('📦 Creator Upload v2.0 - Loading...');
