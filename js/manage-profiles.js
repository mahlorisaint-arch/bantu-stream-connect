// ============================================
// BANTU STREAM CONNECT - MANAGE PROFILES PAGE
// Core JavaScript Implementation
// ============================================

// ============================================
// GLOBAL STATE MANAGEMENT
// ============================================
window.profiles = [];
window.currentEditingProfile = null;
window.favorites = [];
window.watchHistory = [];
window.notifications = [];
window.userProfiles = [];
window.currentUser = null;
window.currentProfile = null;

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
  setupLogoutButton();
  
  // Load additional data if user is authenticated
  if (window.currentUser) {
    loadFavorites();
    loadWatchHistory();
    loadNotifications();
  }
  
  // Initialize UI components
  if (typeof initializeManageProfilesUI === 'function') {
    initializeManageProfilesUI();
  }
  
  // Initialize features
  if (typeof initializeManageProfilesFeatures === 'function') {
    initializeManageProfilesFeatures();
  }
  
  console.log('✅ Manage Profiles Core Initialized');
}

// ============================================
// AUTHENTICATION CHECK
// ============================================
async function checkAuth() {
  try {
    if (!window.supabaseAuth) {
      console.warn('Supabase not initialized yet');
      return null;
    }
    
    const { data, error } = await window.supabaseAuth.auth.getSession();
    if (error) throw error;
    
    const session = data?.session;
    window.currentUser = session?.user || null;
    
    if (window.currentUser) {
      console.log('✅ User authenticated:', window.currentUser.email);
      await loadUserProfile();
    } else {
      console.log('⚠️ User not authenticated');
      if (typeof showToast === 'function') {
        showToast('Please sign in to manage profiles', 'warning');
      }
      setTimeout(() => {
        window.location.href = 'login.html?redirect=manage-profiles.html';
      }, 2000);
    }
    
    return window.currentUser;
  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
}

// ============================================
// LOAD USER PROFILE
// ============================================
async function loadUserProfile() {
  try {
    if (!window.currentUser || !window.supabaseAuth) return;
    
    const { data: profile, error } = await window.supabaseAuth
      .from('user_profiles')
      .select('*')
      .eq('id', window.currentUser.id)
      .maybeSingle();
    
    if (error) {
      console.warn('Profile fetch error:', error);
      return;
    }
    
    if (profile) {
      window.currentProfile = profile;
    }
    
    await loadNotifications();
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// ============================================
// LOAD USER PROFILES
// ============================================
async function loadUserProfiles() {
  if (!window.currentUser || !window.supabaseAuth) return;
  
  try {
    const { data, error } = await window.supabaseAuth
      .from('user_profiles')
      .select('*')
      .eq('id', window.currentUser.id);
    
    if (error) {
      console.warn('Error loading profiles:', error);
      window.userProfiles = [{
        id: window.currentUser.id,
        name: window.currentUser.user_metadata?.full_name || 'Default',
        full_name: window.currentUser.user_metadata?.full_name || 'Default',
        avatar_url: null
      }];
    } else {
      window.userProfiles = data || [];
    }
    
    if (window.userProfiles.length === 0) {
      window.userProfiles = [{
        id: window.currentUser.id,
        name: window.currentUser.user_metadata?.full_name || 'Default',
        full_name: window.currentUser.user_metadata?.full_name || 'Default',
        avatar_url: null
      }];
    }
    
    const savedProfileId = localStorage.getItem('currentProfileId');
    window.currentProfile = window.userProfiles.find(p => p.id === savedProfileId) || window.userProfiles[0];
    
    if (typeof updateProfileSwitcher === 'function') {
      updateProfileSwitcher();
    }
  } catch (error) {
    console.error('Error loading profiles:', error);
  }
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
    if (!window.currentUser || !window.supabaseAuth) {
      if (typeof showToast === 'function') {
        showToast('Please sign in to manage profiles', 'warning');
      }
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
    
    const { data: profiles, error } = await window.supabaseAuth
      .from('user_profiles')
      .select('*')
      .eq('id', window.currentUser.id);
    
    if (error) throw error;
    
    window.profiles = profiles || [];
    
    // If no profile exists, create a default one
    if (window.profiles.length === 0) {
      await createDefaultProfile();
    }
    
    // Render profiles
    renderProfiles();
    
    // Update default profile dropdown
    updateDefaultProfileSelect();
    
  } catch (error) {
    console.error('Error loading profiles:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to load profiles', 'error');
    }
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
// LOAD FAVORITES
// ============================================
async function loadFavorites() {
  try {
    if (!window.currentUser || !window.supabaseAuth) return;
    
    const { data, error } = await window.supabaseAuth
      .from('favorites')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    window.favorites = data || [];
  } catch (error) {
    console.error('Error loading favorites:', error);
  }
}

// ============================================
// LOAD WATCH HISTORY
// ============================================
async function loadWatchHistory() {
  try {
    if (!window.currentUser || !window.supabaseAuth) return;
    
    const { data, error } = await window.supabaseAuth
      .from('watch_history')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('watched_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    window.watchHistory = data || [];
  } catch (error) {
    console.error('Error loading watch history:', error);
  }
}

// ============================================
// LOAD NOTIFICATIONS
// ============================================
async function loadNotifications() {
  try {
    if (!window.currentUser || !window.supabaseAuth) {
      updateNotificationBadge(0);
      return;
    }
    
    const { data, error } = await window.supabaseAuth
      .from('notifications')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.warn('Error loading notifications:', error);
      updateNotificationBadge(0);
      return;
    }
    
    window.notifications = data || [];
    
    const unreadCount = window.notifications.filter(n => !n.is_read).length;
    updateNotificationBadge(unreadCount);
  } catch (error) {
    console.error('Error loading notifications:', error);
    updateNotificationBadge(0);
  }
}

// ============================================
// UPDATE NOTIFICATION BADGE
// ============================================
function updateNotificationBadge(count) {
  const mainBadge = document.getElementById('notification-count');
  const sidebarBadge = document.getElementById('sidebar-notification-count');
  
  [mainBadge, sidebarBadge].forEach(badge => {
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  });
}

// ============================================
// CREATE DEFAULT PROFILE
// ============================================
async function createDefaultProfile() {
  try {
    if (!window.currentUser || !window.supabaseAuth) return;
    
    const defaultProfile = {
      id: window.currentUser.id,
      full_name: window.currentUser.user_metadata?.full_name || window.currentUser.email?.split('@')[0] || 'User',
      username: window.currentUser.email?.split('@')[0] || 'user',
      avatar_url: null,
      bio: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { error } = await window.supabaseAuth
      .from('user_profiles')
      .insert([defaultProfile]);
    
    if (error) throw error;
    
    window.profiles = [defaultProfile];
    window.currentProfile = defaultProfile;
    localStorage.setItem('currentProfileId', defaultProfile.id);
    
    if (typeof showToast === 'function') {
      showToast('Default profile created', 'success');
    }
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
    const initials = getInitials(profile.full_name || profile.username || 'User');
    
    return `
      <div class="profile-card" data-profile-id="${profile.id}">
        <div class="profile-card-header">
          <div class="profile-avatar-large">
            ${profile.avatar_url 
              ? `<img src="${window.contentSupabase.fixMediaUrl(profile.avatar_url)}" alt="${escapeHtml(profile.full_name || profile.username)}">`
              : `<div class="avatar-initials">${initials}</div>`
            }
          </div>
          ${isCurrent ? '<div class="current-profile-badge"><i class="fas fa-check-circle"></i> Current</div>' : ''}
        </div>
        <div class="profile-card-body">
          <h3 class="profile-name">
            ${escapeHtml(profile.full_name || profile.username || 'Profile')}
          </h3>
          <span class="profile-type-badge">
            ${profile.profile_type || 'Adult'}
          </span>
          <p class="profile-bio">${escapeHtml(profile.bio || 'No bio yet')}</p>
          <div class="profile-stats">
            <div class="profile-stat">
              <span class="stat-value">${profile.watch_time ? Math.floor(profile.watch_time / 3600) + 'h' : '0h'}</span>
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
          <button class="profile-action-btn delete-btn" data-profile-id="${profile.id}" data-profile-name="${escapeHtml(profile.full_name || profile.username)}">
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
        ${escapeHtml(profile.full_name || profile.username || 'Profile')}
      </option>
    `).join('');
  
  // Remove existing listener and add new one
  select.removeEventListener('change', handleDefaultProfileChange);
  select.addEventListener('change', handleDefaultProfileChange);
}

function handleDefaultProfileChange(e) {
  const profileId = e.target.value;
  if (profileId) {
    setDefaultProfile(profileId);
  }
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
    updateProfileSwitcher();
    
    if (typeof showToast === 'function') {
      showToast(`Default profile set to ${profile.full_name || profile.username}`, 'success');
    }
  } catch (error) {
    console.error('Error setting default profile:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to set default profile', 'error');
    }
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
  const bioInput = document.getElementById('profile-bio');
  const nameCount = document.getElementById('name-count');
  const bioCount = document.getElementById('bio-count');
  
  // Close modal handlers
  const closeModal = () => {
    modal.classList.remove('active');
    resetProfileForm();
  };
  
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
  
  // Name character count
  if (nameInput && nameCount) {
    nameInput.addEventListener('input', () => {
      nameCount.textContent = nameInput.value.length;
    });
  }
  
  // Bio character count
  if (bioInput && bioCount) {
    bioInput.addEventListener('input', () => {
      bioCount.textContent = bioInput.value.length;
    });
  }
  
  // Upload avatar
  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      await uploadProfileAvatar();
    });
  }
  
  // Generate initials avatar
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      const name = nameInput?.value.trim();
      if (name) {
        generateInitialsAvatar(name);
      } else {
        if (typeof showToast === 'function') {
          showToast('Enter a profile name first', 'warning');
        }
      }
    });
  }
  
  // Save profile
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      await saveProfile();
    });
  }
}

// ============================================
// OPEN CREATE PROFILE MODAL
// ============================================
function openCreateProfileModal() {
  const modal = document.getElementById('profile-modal');
  const modalTitle = document.getElementById('modal-title');
  const profileId = document.getElementById('profile-id');
  const nameInput = document.getElementById('profile-name');
  const bioInput = document.getElementById('profile-bio');
  const avatarImage = document.getElementById('avatar-image');
  const avatarPlaceholder = document.getElementById('avatar-placeholder');
  const nameCount = document.getElementById('name-count');
  const bioCount = document.getElementById('bio-count');
  
  if (!modal || !modalTitle || !profileId || !nameInput || !bioInput || 
      !avatarImage || !avatarPlaceholder || !nameCount || !bioCount) return;
  
  modalTitle.textContent = 'Create New Profile';
  profileId.value = '';
  nameInput.value = '';
  bioInput.value = '';
  nameCount.textContent = '0';
  bioCount.textContent = '0';
  
  // Reset avatar
  avatarImage.style.display = 'none';
  avatarPlaceholder.style.display = 'flex';
  avatarPlaceholder.innerHTML = '<i class="fas fa-user"></i>';
  
  // Reset form fields
  const adultRadio = document.querySelector('input[name="profile-type"][value="adult"]');
  if (adultRadio) adultRadio.checked = true;
  
  document.querySelectorAll('.preference-checkbox input[type="checkbox"]').forEach(cb => {
    cb.checked = cb.value === 'music' || cb.value === 'culture';
  });
  
  const langSelect = document.getElementById('language-preference');
  if (langSelect) {
    Array.from(langSelect.options).forEach(opt => {
      opt.selected = opt.value === 'en';
    });
  }
  
  const maturitySelect = document.getElementById('maturity-rating');
  if (maturitySelect) maturitySelect.value = 'all';
  
  const privateToggle = document.getElementById('private-profile-toggle');
  if (privateToggle) privateToggle.checked = false;
  
  const historyToggle = document.getElementById('show-history-toggle');
  if (historyToggle) historyToggle.checked = true;
  
  const autoplayToggle = document.getElementById('autoplay-toggle');
  if (autoplayToggle) autoplayToggle.checked = true;
  
  const previewToggle = document.getElementById('preview-toggle');
  if (previewToggle) previewToggle.checked = false;
  
  const hdToggle = document.getElementById('hd-toggle');
  if (hdToggle) hdToggle.checked = false;
  
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
  const bioInput = document.getElementById('profile-bio');
  const avatarImage = document.getElementById('avatar-image');
  const avatarPlaceholder = document.getElementById('avatar-placeholder');
  const nameCount = document.getElementById('name-count');
  const bioCount = document.getElementById('bio-count');
  
  if (!modal || !modalTitle || !idInput || !nameInput || !bioInput || 
      !avatarImage || !avatarPlaceholder || !nameCount || !bioCount) return;
  
  modalTitle.textContent = 'Edit Profile';
  idInput.value = profile.id;
  nameInput.value = profile.full_name || profile.username || '';
  bioInput.value = profile.bio || '';
  nameCount.textContent = nameInput.value.length;
  bioCount.textContent = bioInput.value.length;
  
  // Set avatar
  if (profile.avatar_url) {
    avatarImage.src = window.contentSupabase.fixMediaUrl(profile.avatar_url);
    avatarImage.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
  } else {
    avatarImage.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
    const initials = getInitials(profile.full_name || profile.username);
    avatarPlaceholder.innerHTML = `<span style="font-size: 2.5rem; font-weight: bold;">${initials}</span>`;
  }
  
  // Set profile type
  const profileType = profile.profile_type || 'adult';
  const typeRadio = document.querySelector(`input[name="profile-type"][value="${profileType}"]`);
  if (typeRadio) typeRadio.checked = true;
  
  // Set preferences
  const preferences = profile.preferences || ['music', 'culture'];
  document.querySelectorAll('.preference-checkbox input').forEach(cb => {
    cb.checked = preferences.includes(cb.value);
  });
  
  // Set language preference
  const languages = profile.languages || ['en'];
  const langSelect = document.getElementById('language-preference');
  if (langSelect) {
    Array.from(langSelect.options).forEach(opt => {
      opt.selected = languages.includes(opt.value);
    });
  }
  
  // Set maturity rating
  const maturitySelect = document.getElementById('maturity-rating');
  if (maturitySelect) maturitySelect.value = profile.maturity_rating || 'all';
  
  // Set privacy settings
  const privateToggle = document.getElementById('private-profile-toggle');
  if (privateToggle) privateToggle.checked = profile.is_private || false;
  
  const historyToggle = document.getElementById('show-history-toggle');
  if (historyToggle) historyToggle.checked = profile.show_history !== false;
  
  // Set auto-play settings
  const autoplayToggle = document.getElementById('autoplay-toggle');
  if (autoplayToggle) autoplayToggle.checked = profile.autoplay !== false;
  
  const previewToggle = document.getElementById('preview-toggle');
  if (previewToggle) previewToggle.checked = profile.preview_autoplay || false;
  
  const hdToggle = document.getElementById('hd-toggle');
  if (hdToggle) hdToggle.checked = profile.hd_only || false;
  
  modal.classList.add('active');
}

// ============================================
// UPLOAD PROFILE AVATAR
// ============================================
async function uploadProfileAvatar() {
  try {
    if (!window.currentUser || !window.supabaseAuth) {
      if (typeof showToast === 'function') {
        showToast('Please sign in to upload avatar', 'warning');
      }
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
        if (typeof showToast === 'function') {
          showToast('Image must be less than 2MB', 'error');
        }
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        if (typeof showToast === 'function') {
          showToast('Please upload an image file', 'error');
        }
        return;
      }
      
      // Show loading
      if (typeof showToast === 'function') {
        showToast('Uploading...', 'info');
      }
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `avatars/${window.currentUser.id}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await window.supabaseAuth.storage
        .from('avatars')
        .upload(fileName, file);
      
      if (error) {
        console.error('Upload error:', error);
        if (typeof showToast === 'function') {
          showToast('Failed to upload avatar', 'error');
        }
        return;
      }
      
      // Get public URL
      const { data: { publicUrl } } = window.supabaseAuth.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      // Preview image
      const avatarImage = document.getElementById('avatar-image');
      const avatarPlaceholder = document.getElementById('avatar-placeholder');
      
      if (avatarImage && avatarPlaceholder) {
        avatarImage.src = publicUrl;
        avatarImage.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
      }
      
      if (typeof showToast === 'function') {
        showToast('Avatar uploaded successfully', 'success');
      }
    };
    
    input.click();
  } catch (error) {
    console.error('Error uploading avatar:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to upload avatar', 'error');
    }
  }
}

// ============================================
// GENERATE INITIALS AVATAR
// ============================================
function generateInitialsAvatar(name) {
  const initials = getInitials(name);
  const avatarPlaceholder = document.getElementById('avatar-placeholder');
  const avatarImage = document.getElementById('avatar-image');
  
  if (avatarImage && avatarPlaceholder) {
    avatarImage.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
    avatarPlaceholder.innerHTML = `<span style="font-size: 2.5rem; font-weight: bold;">${initials}</span>`;
  }
}

// ============================================
// SAVE PROFILE
// ============================================
async function saveProfile() {
  try {
    const nameInput = document.getElementById('profile-name');
    const bioInput = document.getElementById('profile-bio');
    const name = nameInput?.value.trim();
    const bio = bioInput?.value.trim();
    
    if (!name) {
      if (typeof showToast === 'function') {
        showToast('Please enter a profile name', 'warning');
      }
      nameInput?.focus();
      return;
    }
    
    // Get form data
    const profileType = document.querySelector('input[name="profile-type"]:checked')?.value || 'adult';
    
    const preferences = [];
    document.querySelectorAll('.preference-checkbox input:checked').forEach(cb => {
      preferences.push(cb.value);
    });
    
    const langSelect = document.getElementById('language-preference');
    const languages = langSelect ? Array.from(langSelect.selectedOptions).map(opt => opt.value) : ['en'];
    
    const maturitySelect = document.getElementById('maturity-rating');
    const maturityRating = maturitySelect ? maturitySelect.value : 'all';
    
    const privateToggle = document.getElementById('private-profile-toggle');
    const isPrivate = privateToggle ? privateToggle.checked : false;
    
    const historyToggle = document.getElementById('show-history-toggle');
    const showHistory = historyToggle ? historyToggle.checked : true;
    
    const autoplayToggle = document.getElementById('autoplay-toggle');
    const autoplay = autoplayToggle ? autoplayToggle.checked : true;
    
    const previewToggle = document.getElementById('preview-toggle');
    const previewAutoplay = previewToggle ? previewToggle.checked : false;
    
    const hdToggle = document.getElementById('hd-toggle');
    const hdOnly = hdToggle ? hdToggle.checked : false;
    
    // Get avatar
    let avatarUrl = null;
    const avatarImage = document.getElementById('avatar-image');
    if (avatarImage && avatarImage.style.display === 'block' && avatarImage.src) {
      avatarUrl = avatarImage.src;
    }
    
    const profileId = document.getElementById('profile-id')?.value;
    
    if (profileId) {
      // Update existing profile
      await updateProfile(profileId, {
        full_name: name,
        bio: bio,
        profile_type: profileType,
        preferences,
        languages,
        maturity_rating: maturityRating,
        is_private: isPrivate,
        show_history: showHistory,
        autoplay,
        preview_autoplay: previewAutoplay,
        hd_only: hdOnly,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      });
    } else {
      // Create new profile
      await createProfile({
        full_name: name,
        bio: bio,
        username: name.toLowerCase().replace(/\s+/g, '_'),
        profile_type: profileType,
        preferences,
        languages,
        maturity_rating: maturityRating,
        is_private: isPrivate,
        show_history: showHistory,
        autoplay,
        preview_autoplay: previewAutoplay,
        hd_only: hdOnly,
        avatar_url: avatarUrl
      });
    }
    
    // Close modal
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.remove('active');
    
    // Reload profiles
    await loadProfiles();
    
  } catch (error) {
    console.error('Error saving profile:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to save profile', 'error');
    }
  }
}

// ============================================
// CREATE PROFILE
// ============================================
async function createProfile(profileData) {
  try {
    if (!window.currentUser || !window.supabaseAuth) return;
    
    const { error } = await window.supabaseAuth
      .from('user_profiles')
      .upsert({
        id: window.currentUser.id,
        full_name: profileData.full_name,
        username: profileData.username,
        bio: profileData.bio,
        avatar_url: profileData.avatar_url,
        profile_type: profileData.profile_type,
        preferences: profileData.preferences,
        languages: profileData.languages,
        maturity_rating: profileData.maturity_rating,
        is_private: profileData.is_private,
        show_history: profileData.show_history,
        autoplay: profileData.autoplay,
        preview_autoplay: profileData.preview_autoplay,
        hd_only: profileData.hd_only,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
    
    if (typeof showToast === 'function') {
      showToast('Profile created successfully', 'success');
    }
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
    if (!window.supabaseAuth) return;
    
    const { error } = await window.supabaseAuth
      .from('user_profiles')
      .update({
        full_name: profileData.full_name,
        bio: profileData.bio,
        avatar_url: profileData.avatar_url,
        profile_type: profileData.profile_type,
        preferences: profileData.preferences,
        languages: profileData.languages,
        maturity_rating: profileData.maturity_rating,
        is_private: profileData.is_private,
        show_history: profileData.show_history,
        autoplay: profileData.autoplay,
        preview_autoplay: profileData.preview_autoplay,
        hd_only: profileData.hd_only,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId);
    
    if (error) throw error;
    
    if (typeof showToast === 'function') {
      showToast('Profile updated successfully', 'success');
    }
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
  
  const profileId = document.getElementById('profile-id');
  const nameInput = document.getElementById('profile-name');
  const bioInput = document.getElementById('profile-bio');
  const nameCount = document.getElementById('name-count');
  const bioCount = document.getElementById('bio-count');
  
  if (profileId) profileId.value = '';
  if (nameInput) nameInput.value = '';
  if (bioInput) bioInput.value = '';
  if (nameCount) nameCount.textContent = '0';
  if (bioCount) bioCount.textContent = '0';
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
    if (deleteModal) deleteModal.classList.remove('active');
  };
  
  if (cancelDelete) cancelDelete.addEventListener('click', closeDeleteModal);
  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) closeDeleteModal();
    });
  }
  if (confirmDelete) {
    confirmDelete.addEventListener('click', async () => {
      const profileId = deleteModal?.dataset.profileId;
      if (profileId) {
        await deleteProfile(profileId);
        closeDeleteModal();
      }
    });
  }
  
  // Delete all modal
  const deleteAllModal = document.getElementById('delete-all-modal');
  const cancelDeleteAll = document.getElementById('cancel-delete-all-btn');
  const confirmDeleteAll = document.getElementById('confirm-delete-all-btn');
  const deleteAllBtn = document.getElementById('delete-all-profiles-btn');
  const deleteConfirmation = document.getElementById('delete-confirmation');
  
  const closeDeleteAllModal = () => {
    if (deleteAllModal) deleteAllModal.classList.remove('active');
    if (deleteConfirmation) deleteConfirmation.value = '';
    if (confirmDeleteAll) confirmDeleteAll.disabled = true;
  };
  
  if (cancelDeleteAll) cancelDeleteAll.addEventListener('click', closeDeleteAllModal);
  if (deleteAllModal) {
    deleteAllModal.addEventListener('click', (e) => {
      if (e.target === deleteAllModal) closeDeleteAllModal();
    });
  }
  if (deleteConfirmation) {
    deleteConfirmation.addEventListener('input', (e) => {
      if (confirmDeleteAll) {
        confirmDeleteAll.disabled = e.target.value !== 'DELETE';
      }
    });
  }
  if (confirmDeleteAll) {
    confirmDeleteAll.addEventListener('click', async () => {
      await deleteAllProfiles();
      closeDeleteAllModal();
    });
  }
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', () => {
      if (window.profiles.length === 0) {
        if (typeof showToast === 'function') {
          showToast('No profiles to delete', 'info');
        }
        return;
      }
      if (deleteAllModal) deleteAllModal.classList.add('active');
    });
  }
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
  if (deleteModal) {
    deleteModal.dataset.profileId = profileId;
    deleteModal.classList.add('active');
  }
}

// ============================================
// DELETE PROFILE
// ============================================
async function deleteProfile(profileId) {
  const confirmBtn = document.getElementById('confirm-delete-btn');
  const spinner = confirmBtn?.querySelector('.fa-spinner');
  const btnText = confirmBtn?.querySelector('span');
  
  try {
    // Show loading state
    if (confirmBtn) confirmBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (btnText) btnText.textContent = 'Deleting...';
    
    // Prevent deleting current profile
    if (window.currentProfile?.id === profileId) {
      if (typeof showToast === 'function') {
        showToast('Cannot delete current profile', 'warning');
      }
      return;
    }
    
    // Delete profile from database
    if (!window.supabaseAuth) return;
    
    const { error } = await window.supabaseAuth
      .from('user_profiles')
      .delete()
      .eq('id', profileId);
    
    if (error) throw error;
    
    if (typeof showToast === 'function') {
      showToast('Profile deleted successfully', 'success');
    }
    
    // Remove from local array
    window.profiles = window.profiles.filter(p => p.id !== profileId);
    
    // Re-render
    renderProfiles();
    updateDefaultProfileSelect();
    
  } catch (error) {
    console.error('Error deleting profile:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to delete profile', 'error');
    }
  } finally {
    // Reset button state
    if (confirmBtn) confirmBtn.disabled = false;
    if (spinner) spinner.style.display = 'none';
    if (btnText) btnText.textContent = 'Delete Permanently';
  }
}

// ============================================
// DELETE ALL PROFILES
// ============================================
async function deleteAllProfiles() {
  const confirmBtn = document.getElementById('confirm-delete-all-btn');
  const spinner = confirmBtn?.querySelector('.fa-spinner');
  const btnText = confirmBtn?.querySelector('span');
  
  try {
    // Show loading state
    if (confirmBtn) confirmBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (btnText) btnText.textContent = 'Deleting...';
    
    // Keep only current profile
    const currentId = window.currentProfile?.id;
    
    // Delete all other profiles
    if (!window.supabaseAuth) return;
    
    for (const profile of window.profiles) {
      if (profile.id !== currentId) {
        await window.supabaseAuth
          .from('user_profiles')
          .delete()
          .eq('id', profile.id);
      }
    }
    
    window.profiles = window.profiles.filter(p => p.id === currentId);
    
    renderProfiles();
    updateDefaultProfileSelect();
    
    if (typeof showToast === 'function') {
      showToast('All other profiles deleted', 'success');
    }
  } catch (error) {
    console.error('Error deleting all profiles:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to delete profiles', 'error');
    }
  } finally {
    // Reset button state
    if (confirmBtn) confirmBtn.disabled = false;
    if (spinner) spinner.style.display = 'none';
    if (btnText) btnText.textContent = 'Delete All';
  }
}

// ============================================
// SETTINGS CONTROLS
// ============================================
function setupSettingsControls() {
  // Load saved settings
  const profileSwitching = localStorage.getItem('profileSwitching') !== 'false';
  const autoLoad = localStorage.getItem('autoLoadContinueWatching') !== 'false';
  
  const switchingToggle = document.getElementById('profile-switching-toggle');
  const autoLoadToggle = document.getElementById('auto-load-toggle');
  
  if (switchingToggle) switchingToggle.checked = profileSwitching;
  if (autoLoadToggle) autoLoadToggle.checked = autoLoad;
  
  // Save settings on change
  if (switchingToggle) {
    switchingToggle.addEventListener('change', (e) => {
      localStorage.setItem('profileSwitching', e.target.checked);
      if (typeof showToast === 'function') {
        showToast('Profile switching ' + (e.target.checked ? 'enabled' : 'disabled'), 'success');
      }
    });
  }
  
  if (autoLoadToggle) {
    autoLoadToggle.addEventListener('change', (e) => {
      localStorage.setItem('autoLoadContinueWatching', e.target.checked);
      if (typeof showToast === 'function') {
        showToast('Auto-load ' + (e.target.checked ? 'enabled' : 'disabled'), 'success');
      }
    });
  }
}

// ============================================
// ADD PROFILE BUTTON
// ============================================
function setupAddProfileButton() {
  const addBtn = document.getElementById('add-profile-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openCreateProfileModal();
    });
  }
  
  // Also handle the create-first button if it exists
  document.addEventListener('click', (e) => {
    if (e.target.closest('#create-first-profile')) {
      openCreateProfileModal();
    }
  });
}

// ============================================
// LOGOUT BUTTON
// ============================================
function setupLogoutButton() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn && window.supabaseAuth) {
    logoutBtn.addEventListener('click', async () => {
      await window.supabaseAuth.auth.signOut();
      window.currentUser = null;
      window.currentProfile = null;
      window.userProfiles = [];
      localStorage.removeItem('currentProfileId');
      if (typeof showToast === 'function') {
        showToast('Signed out successfully', 'success');
      }
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    });
  }
}

// ============================================
// UPDATE HEADER PROFILE
// ============================================
function updateHeaderProfile() {
  const profileName = document.getElementById('current-profile-name');
  const profilePlaceholder = document.getElementById('userProfilePlaceholder');
  
  if (profileName) {
    profileName.textContent = window.currentProfile?.full_name || window.currentProfile?.username || 'Guest';
  }
  
  if (profilePlaceholder && window.currentProfile?.avatar_url) {
    profilePlaceholder.innerHTML = `<img src="${window.contentSupabase.fixMediaUrl(window.currentProfile.avatar_url)}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
  }
}

// ============================================
// UPDATE PROFILE SWITCHER
// ============================================
function updateProfileSwitcher() {
  const profileList = document.getElementById('profile-list');
  if (!profileList) return;
  
  profileList.innerHTML = window.userProfiles.map(profile => {
    const isCurrent = window.currentProfile?.id === profile.id;
    const initials = getInitials(profile.full_name || profile.name || 'User');
    
    return `
      <button class="profile-list-item ${isCurrent ? 'active' : ''}" data-profile-id="${profile.id}">
        <div class="profile-avatar-small">
          ${profile.avatar_url 
            ? `<img src="${window.contentSupabase.fixMediaUrl(profile.avatar_url)}" alt="${escapeHtml(profile.full_name || profile.name)}">`
            : `<div class="avatar-initials">${initials}</div>`
          }
        </div>
        <span class="profile-list-name">${escapeHtml(profile.full_name || profile.name || 'Profile')}</span>
        ${isCurrent ? '<i class="fas fa-check"></i>' : ''}
      </button>
    `;
  }).join('');
  
  profileList.querySelectorAll('.profile-list-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const profileId = btn.dataset.profileId;
      await switchProfile(profileId);
    });
  });
}

// ============================================
// SWITCH PROFILE
// ============================================
async function switchProfile(profileId) {
  const profile = window.userProfiles.find(p => p.id === profileId);
  if (!profile) return;
  
  window.currentProfile = profile;
  localStorage.setItem('currentProfileId', profileId);
  
  updateHeaderProfile();
  updateProfileSwitcher();
  
  if (typeof showToast === 'function') {
    showToast(`Switched to ${profile.full_name || profile.name}`, 'success');
  }
  
  // Reload page-specific data if needed
  if (localStorage.getItem('autoLoadContinueWatching') !== 'false') {
    // Trigger any auto-load functionality
    document.dispatchEvent(new CustomEvent('profileSwitched', { detail: { profile } }));
  }
}

// ============================================
// NAVIGATION
// ============================================
function setupNavigation() {
  // Manage profiles button in dropdown
  const manageProfilesBtn = document.getElementById('manage-profiles-btn');
  if (manageProfilesBtn) {
    manageProfilesBtn.addEventListener('click', () => {
      window.location.href = 'manage-profiles.html';
    });
  }
  
  // Home button
  const navHomeBtn = document.getElementById('nav-home-btn');
  if (navHomeBtn) {
    navHomeBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
  
  // Create button
  const navCreateBtn = document.getElementById('nav-create-btn');
  if (navCreateBtn && window.supabaseAuth) {
    navCreateBtn.addEventListener('click', async () => {
      const { data } = await window.supabaseAuth.auth.getSession();
      if (data?.session) {
        window.location.href = 'creator-upload.html';
      } else {
        if (typeof showToast === 'function') {
          showToast('Please sign in to create content', 'warning');
        }
        window.location.href = 'login.html?redirect=creator-upload.html';
      }
    });
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    error: 'fa-exclamation-triangle',
    success: 'fa-check-circle',
    warning: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `
    <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getInitials(name) {
  if (!name || name.trim() === '') return '?';
  const names = name.trim().split(' ');
  if (names.length >= 2) {
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
}

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toString() || '0';
}

// ============================================
// EXPORT FUNCTIONS TO GLOBAL SCOPE
// ============================================
window.initializeManageProfiles = initializeManageProfiles;
window.openCreateProfileModal = openCreateProfileModal;
window.openEditProfileModal = openEditProfileModal;
window.loadProfiles = loadProfiles;
window.loadFavorites = loadFavorites;
window.loadWatchHistory = loadWatchHistory;
window.loadNotifications = loadNotifications;
window.checkAuth = checkAuth;
window.loadUserProfile = loadUserProfile;
window.loadUserProfiles = loadUserProfiles;
window.updateNotificationBadge = updateNotificationBadge;
window.updateHeaderProfile = updateHeaderProfile;
window.updateProfileSwitcher = updateProfileSwitcher;
window.switchProfile = switchProfile;
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.getInitials = getInitials;
window.formatNumber = formatNumber;
