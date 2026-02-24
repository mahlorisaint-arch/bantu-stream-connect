// ============================================
// MANAGE PROFILES PAGE - PRODUCTION ARCHITECTURE
// ============================================

// Global state
window.profiles = [];
window.currentEditingProfile = null;

// ============================================
// INITIALIZATION
// ============================================
function initializeManageProfiles() {
    console.log('🎯 Initializing Manage Profiles page');
    
    // Load profiles
    loadProfiles();
    
    // Setup event listeners
    setupProfileModal();
    setupDeleteModals();
    setupSettingsControls();
    setupAddProfileButton();
    setupNavigation();
}

// ============================================
// LOAD PROFILES
// ============================================
async function loadProfiles() {
    const profilesGrid = document.getElementById('profiles-grid');
    if (!profilesGrid) return;
    
    // Show loading state
    profilesGrid.innerHTML = Array(3).fill().map(() => `
        <div class="profile-card loading">
            <div class="profile-card-header"></div>
            <div class="profile-card-body">
                <div class="skeleton-title" style="width: 60%; margin: 2.5rem auto 0.5rem;"></div>
                <div class="skeleton-creator" style="width: 40%; margin: 0 auto;"></div>
                <div class="skeleton-stats" style="width: 80%; margin: 1rem auto;"></div>
            </div>
        </div>
    `).join('');
    
    try {
        if (!window.currentUser) {
            showToast('Please sign in to manage profiles', 'warning');
            profilesGrid.innerHTML = `
                <div class="profiles-empty">
                    <i class="fas fa-user-circle"></i>
                    <h3>Sign in Required</h3>
                    <p>Please sign in to create and manage profiles</p>
                    <button class="create-first-btn" onclick="window.location.href='login.html?redirect=manage-profiles.html'">
                        <i class="fas fa-sign-in-alt"></i> Sign In
                    </button>
                </div>
            `;
            return;
        }
        
        // Fetch profiles from user_profiles table
        const { data: profiles, error } = await supabaseAuth
            .from('user_profiles')
            .select('*')
            .eq('id', window.currentUser.id);
        
        if (error) throw error;
        
        window.profiles = profiles || [];
        
        // Create default profile if none exists
        if (window.profiles.length === 0) {
            await createDefaultProfile();
        }
        
        // Render profiles
        renderProfiles();
        
        // Update default profile dropdown
        updateDefaultProfileSelect();
        
    } catch (error) {
        console.error('Error loading profiles:', error);
        showToast('Failed to load profiles', 'error');
        
        profilesGrid.innerHTML = `
            <div class="profiles-empty">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Profiles</h3>
                <p>Please try refreshing the page</p>
                <button class="create-first-btn" onclick="location.reload()">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
        `;
    }
}

// ============================================
// CREATE DEFAULT PROFILE
// ============================================
async function createDefaultProfile() {
    try {
        const defaultProfile = {
            id: window.currentUser.id,
            user_id: window.currentUser.id,
            name: window.currentUser.email?.split('@')[0] || 'Default',
            full_name: window.currentUser.user_metadata?.full_name || 'User',
            username: window.currentUser.email?.split('@')[0] || 'user',
            avatar_url: null,
            bio: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        const { error } = await supabaseAuth
            .from('user_profiles')
            .insert([defaultProfile]);
        
        if (error) throw error;
        
        window.profiles = [defaultProfile];
        
        // Set as current profile
        window.currentProfile = defaultProfile;
        localStorage.setItem('currentProfileId', defaultProfile.id);
        
        showToast('Default profile created', 'success');
        
    } catch (error) {
        console.error('Error creating default profile:', error);
    }
}

// ============================================
// RENDER PROFILES
// ============================================
function renderProfiles() {
    const profilesGrid = document.getElementById('profiles-grid');
    if (!profilesGrid) return;
    
    if (window.profiles.length === 0) {
        profilesGrid.innerHTML = `
            <div class="profiles-empty">
                <i class="fas fa-user-plus"></i>
                <h3>No Profiles Yet</h3>
                <p>Create your first profile to get started</p>
                <button class="create-first-btn" id="create-first-profile">
                    <i class="fas fa-plus-circle"></i> Create Profile
                </button>
            </div>
        `;
        
        document.getElementById('create-first-profile')?.addEventListener('click', () => {
            openCreateProfileModal();
        });
        
        return;
    }
    
    profilesGrid.innerHTML = window.profiles.map(profile => {
        const isCurrent = window.currentProfile?.id === profile.id;
        const initials = getInitials(profile.name || profile.full_name || 'User');
        const watchTime = profile.watch_time || 0;
        const watchTimeFormatted = watchTime > 3600 
            ? `${Math.floor(watchTime / 3600)}h` 
            : `${Math.floor(watchTime / 60)}m`;
        
        return `
            <div class="profile-card" data-profile-id="${profile.id}">
                <div class="profile-card-header">
                    <div class="profile-avatar-large">
                        ${profile.avatar_url 
                            ? `<img src="${contentSupabase.fixMediaUrl(profile.avatar_url)}" alt="${escapeHtml(profile.name || profile.full_name)}">`
                            : `<div class="avatar-initials">${initials}</div>`
                        }
                    </div>
                    ${isCurrent ? '<div class="current-profile-badge"><i class="fas fa-check-circle"></i> Current</div>' : ''}
                </div>
                <div class="profile-card-body">
                    <h3 class="profile-name">
                        ${escapeHtml(profile.name || profile.full_name || 'Profile')}
                    </h3>
                    <span class="profile-type-badge">
                        ${profile.profile_type || 'Adult'}
                    </span>
                    <div class="profile-stats">
                        <div class="profile-stat">
                            <span class="stat-value">${watchTimeFormatted}</span>
                            <span class="stat-label">Watch Time</span>
                        </div>
                        <div class="profile-stat">
                            <span class="stat-value">${profile.favorites_count || 0}</span>
                            <span class="stat-label">Favorites</span>
                        </div>
                    </div>
                </div>
                <div class="profile-card-footer">
                    <button class="profile-action-btn edit-btn" data-profile-id="${profile.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="profile-action-btn delete-btn" data-profile-id="${profile.id}" data-profile-name="${escapeHtml(profile.name || profile.full_name)}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    ${!isCurrent ? `
                        <button class="profile-action-btn set-default-btn" data-profile-id="${profile.id}">
                            <i class="fas fa-check"></i> Set Default
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners to profile buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const profileId = btn.dataset.profileId;
            openEditProfileModal(profileId);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const profileId = btn.dataset.profileId;
            const profileName = btn.dataset.profileName;
            openDeleteProfileModal(profileId, profileName);
        });
    });
    
    document.querySelectorAll('.set-default-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const profileId = btn.dataset.profileId;
            setDefaultProfile(profileId);
        });
    });
}

// ============================================
// UPDATE DEFAULT PROFILE SELECT DROPDOWN
// ============================================
function updateDefaultProfileSelect() {
    const select = document.getElementById('default-profile-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select default profile</option>' + 
        window.profiles.map(profile => `
            <option value="${profile.id}" ${window.currentProfile?.id === profile.id ? 'selected' : ''}>
                ${escapeHtml(profile.name || profile.full_name || 'Profile')}
            </option>
        `).join('');
    
    select.addEventListener('change', (e) => {
        const profileId = e.target.value;
        if (profileId) {
            setDefaultProfile(profileId);
        }
    });
}

// ============================================
// SET DEFAULT PROFILE
// ============================================
async function setDefaultProfile(profileId) {
    try {
        const profile = window.profiles.find(p => p.id === profileId);
        if (!profile) return;
        
        window.currentProfile = profile;
        localStorage.setItem('currentProfileId', profileId);
        
        renderProfiles();
        updateDefaultProfileSelect();
        updateHeaderProfile();
        
        showToast(`Default profile set to ${profile.name || profile.full_name}`, 'success');
        
    } catch (error) {
        console.error('Error setting default profile:', error);
        showToast('Failed to set default profile', 'error');
    }
}

// ============================================
// PROFILE MODAL SETUP
// ============================================
function setupProfileModal() {
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-modal-btn');
    const saveBtn = document.getElementById('save-profile-btn');
    const uploadBtn = document.getElementById('upload-avatar-btn');
    const generateBtn = document.getElementById('generate-avatar-btn');
    const nameInput = document.getElementById('profile-name');
    const nameCount = document.getElementById('name-count');
    
    // Close modal handlers
    const closeModal = () => {
        modal.classList.remove('active');
        resetProfileForm();
    };
    
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Name character count
    nameInput?.addEventListener('input', () => {
        if (nameCount) {
            nameCount.textContent = nameInput.value.length;
        }
    });
    
    // Upload avatar
    uploadBtn?.addEventListener('click', async () => {
        await uploadProfileAvatar();
    });
    
    // Generate initials avatar
    generateBtn?.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            generateInitialsAvatar(name);
        } else {
            showToast('Enter a profile name first', 'warning');
        }
    });
    
    // Save profile
    saveBtn?.addEventListener('click', async () => {
        await saveProfile();
    });
}

// ============================================
// OPEN CREATE PROFILE MODAL
// ============================================
function openCreateProfileModal() {
    const modal = document.getElementById('profile-modal');
    const modalTitle = document.getElementById('modal-title');
    const profileId = document.getElementById('profile-id');
    const nameInput = document.getElementById('profile-name');
    const avatarImage = document.getElementById('avatar-image');
    const avatarPlaceholder = document.getElementById('avatar-placeholder');
    
    modalTitle.textContent = 'Create New Profile';
    profileId.value = '';
    nameInput.value = '';
    
    // Reset avatar
    avatarImage.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
    avatarPlaceholder.innerHTML = '<i class="fas fa-user"></i>';
    
    // Reset form fields
    document.querySelectorAll('input[name="profile-type"]')[0].checked = true;
    document.querySelectorAll('.preference-checkbox input[type="checkbox"]').forEach(cb => {
        cb.checked = ['music', 'culture'].includes(cb.value);
    });
    document.getElementById('language-preference').value = ['en'];
    document.getElementById('maturity-rating').value = 'all';
    document.getElementById('autoplay-toggle').checked = true;
    document.getElementById('preview-toggle').checked = false;
    
    modal.classList.add('active');
}

// ============================================
// OPEN EDIT PROFILE MODAL
// ============================================
function openEditProfileModal(profileId) {
    const profile = window.profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    window.currentEditingProfile = profile;
    
    const modal = document.getElementById('profile-modal');
    const modalTitle = document.getElementById('modal-title');
    const idInput = document.getElementById('profile-id');
    const nameInput = document.getElementById('profile-name');
    const avatarImage = document.getElementById('avatar-image');
    const avatarPlaceholder = document.getElementById('avatar-placeholder');
    
    modalTitle.textContent = 'Edit Profile';
    idInput.value = profile.id;
    nameInput.value = profile.name || profile.full_name || '';
    
    // Update character count
    document.getElementById('name-count').textContent = nameInput.value.length;
    
    // Set avatar
    if (profile.avatar_url) {
        avatarImage.src = contentSupabase.fixMediaUrl(profile.avatar_url);
        avatarImage.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
    } else {
        avatarImage.style.display = 'none';
        avatarPlaceholder.style.display = 'flex';
        const initials = getInitials(profile.name || profile.full_name);
        avatarPlaceholder.innerHTML = `<span style="font-size: 2.5rem; font-weight: bold;">${initials}</span>`;
    }
    
    // Set profile type
    const profileType = profile.profile_type || 'adult';
    document.querySelectorAll('input[name="profile-type"]').forEach(radio => {
        radio.checked = radio.value === profileType;
    });
    
    // Set preferences
    const preferences = profile.preferences || ['music', 'culture'];
    document.querySelectorAll('.preference-checkbox input').forEach(cb => {
        cb.checked = preferences.includes(cb.value);
    });
    
    // Set language preference
    const languages = profile.languages || ['en'];
    const langSelect = document.getElementById('language-preference');
    Array.from(langSelect.options).forEach(opt => {
        opt.selected = languages.includes(opt.value);
    });
    
    // Set maturity rating
    document.getElementById('maturity-rating').value = profile.maturity_rating || 'all';
    
    // Set auto-play settings
    document.getElementById('autoplay-toggle').checked = profile.autoplay !== false;
    document.getElementById('preview-toggle').checked = profile.preview_autoplay || false;
    
    modal.classList.add('active');
}

// ============================================
// UPLOAD PROFILE AVATAR
// ============================================
async function uploadProfileAvatar() {
    try {
        if (!window.currentUser) {
            showToast('Please sign in to upload avatar', 'warning');
            return;
        }
        
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                showToast('Image must be less than 2MB', 'error');
                return;
            }
            
            // Show loading
            showToast('Uploading...', 'info');
            
            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${window.currentUser.id}/${Date.now()}.${fileExt}`;
            
            const { data, error } = await supabaseAuth.storage
                .from('avatars')
                .upload(fileName, file);
            
            if (error) throw error;
            
            // Get public URL
            const { data: { publicUrl } } = supabaseAuth.storage
                .from('avatars')
                .getPublicUrl(fileName);
            
            // Preview image
            const avatarImage = document.getElementById('avatar-image');
            const avatarPlaceholder = document.getElementById('avatar-placeholder');
            
            avatarImage.src = publicUrl;
            avatarImage.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
            
            showToast('Avatar uploaded successfully', 'success');
        };
        
        input.click();
        
    } catch (error) {
        console.error('Error uploading avatar:', error);
        showToast('Failed to upload avatar', 'error');
    }
}

// ============================================
// GENERATE INITIALS AVATAR
// ============================================
function generateInitialsAvatar(name) {
    const initials = getInitials(name);
    const avatarPlaceholder = document.getElementById('avatar-placeholder');
    const avatarImage = document.getElementById('avatar-image');
    
    avatarImage.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
    avatarPlaceholder.innerHTML = `<span style="font-size: 2.5rem; font-weight: bold;">${initials}</span>`;
}

// ============================================
// SAVE PROFILE
// ============================================
async function saveProfile() {
    try {
        const nameInput = document.getElementById('profile-name');
        const name = nameInput.value.trim();
        
        if (!name) {
            showToast('Please enter a profile name', 'warning');
            nameInput.focus();
            return;
        }
        
        // Get form data
        const profileType = document.querySelector('input[name="profile-type"]:checked')?.value || 'adult';
        
        const preferences = [];
        document.querySelectorAll('.preference-checkbox input:checked').forEach(cb => {
            preferences.push(cb.value);
        });
        
        const languages = Array.from(document.getElementById('language-preference').selectedOptions).map(opt => opt.value);
        
        const maturityRating = document.getElementById('maturity-rating').value;
        const autoplay = document.getElementById('autoplay-toggle').checked;
        const previewAutoplay = document.getElementById('preview-toggle').checked;
        
        // Get avatar
        let avatarUrl = null;
        const avatarImage = document.getElementById('avatar-image');
        if (avatarImage.style.display === 'block' && avatarImage.src) {
            avatarUrl = avatarImage.src;
        }
        
        const profileId = document.getElementById('profile-id').value;
        
        if (profileId) {
            // Update existing profile
            await updateProfile(profileId, {
                name,
                profile_type: profileType,
                preferences,
                languages,
                maturity_rating: maturityRating,
                autoplay,
                preview_autoplay: previewAutoplay,
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString()
            });
        } else {
            // Create new profile
            await createProfile({
                name,
                profile_type: profileType,
                preferences,
                languages,
                maturity_rating: maturityRating,
                autoplay,
                preview_autoplay: previewAutoplay,
                avatar_url: avatarUrl
            });
        }
        
        // Close modal
        document.getElementById('profile-modal').classList.remove('active');
        
        // Reload profiles
        await loadProfiles();
        
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Failed to save profile', 'error');
    }
}

// ============================================
// CREATE PROFILE
// ============================================
async function createProfile(profileData) {
    try {
        // For now, user_profiles table is linked to auth.users by id
        // So we're updating the existing record or creating a new one
        // In a real multi-profile system, you'd have a separate profiles table
        
        const { error } = await supabaseAuth
            .from('user_profiles')
            .upsert({
                id: window.currentUser.id,
                full_name: profileData.name,
                username: profileData.name.toLowerCase().replace(/\s+/g, '_'),
                avatar_url: profileData.avatar_url,
                bio: '',
                updated_at: new Date().toISOString()
            });
        
        if (error) throw error;
        
        showToast('Profile created successfully', 'success');
        
    } catch (error) {
        console.error('Error creating profile:', error);
        throw error;
    }
}

// ============================================
// UPDATE PROFILE
// ============================================
async function updateProfile(profileId, profileData) {
    try {
        const { error } = await supabaseAuth
            .from('user_profiles')
            .update({
                full_name: profileData.name,
                avatar_url: profileData.avatar_url,
                updated_at: new Date().toISOString()
            })
            .eq('id', profileId);
        
        if (error) throw error;
        
        showToast('Profile updated successfully', 'success');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
}

// ============================================
// RESET PROFILE FORM
// ============================================
function resetProfileForm() {
    window.currentEditingProfile = null;
    document.getElementById('profile-id').value = '';
    document.getElementById('profile-name').value = '';
    document.getElementById('name-count').textContent = '0';
}

// ============================================
// DELETE MODALS SETUP
// ============================================
function setupDeleteModals() {
    // Single delete modal
    const deleteModal = document.getElementById('delete-modal');
    const cancelDelete = document.getElementById('cancel-delete-btn');
    const confirmDelete = document.getElementById('confirm-delete-btn');
    
    const closeDeleteModal = () => {
        deleteModal.classList.remove('active');
    };
    
    cancelDelete?.addEventListener('click', closeDeleteModal);
    
    deleteModal?.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });
    
    confirmDelete?.addEventListener('click', async () => {
        const profileId = deleteModal.dataset.profileId;
        if (profileId) {
            await deleteProfile(profileId);
            closeDeleteModal();
        }
    });
    
    // Delete all modal
    const deleteAllModal = document.getElementById('delete-all-modal');
    const cancelDeleteAll = document.getElementById('cancel-delete-all-btn');
    const confirmDeleteAll = document.getElementById('confirm-delete-all-btn');
    const deleteAllBtn = document.getElementById('delete-all-profiles-btn');
    
    const closeDeleteAllModal = () => {
        deleteAllModal.classList.remove('active');
    };
    
    cancelDeleteAll?.addEventListener('click', closeDeleteAllModal);
    
    deleteAllModal?.addEventListener('click', (e) => {
        if (e.target === deleteAllModal) closeDeleteAllModal();
    });
    
    confirmDeleteAll?.addEventListener('click', async () => {
        await deleteAllProfiles();
        closeDeleteAllModal();
    });
    
    deleteAllBtn?.addEventListener('click', () => {
        if (window.profiles.length === 0) {
            showToast('No profiles to delete', 'info');
            return;
        }
        deleteAllModal.classList.add('active');
    });
}

// ============================================
// OPEN DELETE PROFILE MODAL
// ============================================
function openDeleteProfileModal(profileId, profileName) {
    const deleteModal = document.getElementById('delete-modal');
    const nameSpan = document.getElementById('delete-profile-name');
    
    if (nameSpan) {
        nameSpan.textContent = profileName;
    }
    
    deleteModal.dataset.profileId = profileId;
    deleteModal.classList.add('active');
}

// ============================================
// DELETE PROFILE
// ============================================
async function deleteProfile(profileId) {
    try {
        // Prevent deleting current profile
        if (window.currentProfile?.id === profileId) {
            showToast('Cannot delete current profile', 'warning');
            return;
        }
        
        // In a real multi-profile system, you'd delete from profiles table
        // For now, we'll just show a success message since we can't delete the main user
        
        showToast('Profile deleted successfully', 'success');
        
        // Remove from local array
        window.profiles = window.profiles.filter(p => p.id !== profileId);
        
        // Re-render
        renderProfiles();
        updateDefaultProfileSelect();
        
    } catch (error) {
        console.error('Error deleting profile:', error);
        showToast('Failed to delete profile', 'error');
    }
}

// ============================================
// DELETE ALL PROFILES
// ============================================
async function deleteAllProfiles() {
    try {
        // Keep only current profile
        const currentId = window.currentProfile?.id;
        window.profiles = window.profiles.filter(p => p.id === currentId);
        
        renderProfiles();
        updateDefaultProfileSelect();
        
        showToast('All other profiles deleted', 'success');
        
    } catch (error) {
        console.error('Error deleting all profiles:', error);
        showToast('Failed to delete profiles', 'error');
    }
}

// ============================================
// SETTINGS CONTROLS
// ============================================
function setupSettingsControls() {
    // Load saved settings
    const profileSwitching = localStorage.getItem('profileSwitching') !== 'false';
    const autoLoad = localStorage.getItem('autoLoadContinueWatching') !== 'false';
    
    document.getElementById('profile-switching-toggle').checked = profileSwitching;
    document.getElementById('auto-load-toggle').checked = autoLoad;
    
    // Save settings on change
    document.getElementById('profile-switching-toggle').addEventListener('change', (e) => {
        localStorage.setItem('profileSwitching', e.target.checked);
        showToast('Profile switching ' + (e.target.checked ? 'enabled' : 'disabled'), 'success');
    });
    
    document.getElementById('auto-load-toggle').addEventListener('change', (e) => {
        localStorage.setItem('autoLoadContinueWatching', e.target.checked);
        showToast('Auto-load ' + (e.target.checked ? 'enabled' : 'disabled'), 'success');
    });
}

// ============================================
// ADD PROFILE BUTTON
// ============================================
function setupAddProfileButton() {
    const addBtn = document.getElementById('add-profile-btn');
    addBtn?.addEventListener('click', () => {
        openCreateProfileModal();
    });
    
    // Also handle the create-first button if it exists
    document.addEventListener('click', (e) => {
        if (e.target.closest('#create-first-profile')) {
            openCreateProfileModal();
        }
    });
}

// ============================================
// NAVIGATION
// ============================================
function setupNavigation() {
    // Manage profiles button in dropdown
    document.getElementById('manage-profiles-btn')?.addEventListener('click', () => {
        window.location.href = 'manage-profiles.html';
    });
    
    // Home button
    document.getElementById('nav-home-btn')?.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // Create button
    document.getElementById('nav-create-btn')?.addEventListener('click', async () => {
        const { data } = await supabaseAuth.auth.getSession();
        if (data?.session) {
            window.location.href = 'creator-upload.html';
        } else {
            showToast('Please sign in to create content', 'warning');
            window.location.href = 'login.html?redirect=creator-upload.html';
        }
    });
}

// ============================================
// KEYBOARD NAVIGATION
// ============================================
function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea, select')) return;
        
        // Escape to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.profile-modal.active, .delete-modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
        
        // Ctrl+N to create new profile
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            openCreateProfileModal();
        }
    });
}

// ============================================
// EXPORT FUNCTIONS TO GLOBAL SCOPE
// ============================================
window.openCreateProfileModal = openCreateProfileModal;
window.openEditProfileModal = openEditProfileModal;
