// ============================================
// AUTH-PROFILE - AUTHENTICATION & PROFILE MANAGEMENT
// ============================================

// ===== AUTH CHECK =====
async function checkAuth() {
  try {
    if (!window.supabase) {
      console.warn('⚠️ Supabase not available for auth check');
      return null;
    }
    
    const { data, error } = await window.supabase.auth.getSession();
    if (error) throw error;
    
    window.currentUser = data?.session?.user || null;
    
    if (window.currentUser) {
      console.log('✅ User authenticated:', window.currentUser.email);
      await loadUserProfile();
    }
    
    return window.currentUser;
  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
}

async function loadUserProfile() {
  try {
    if (!window.currentUser || !window.supabase) return;
    
    const { data: profile, error } = await window.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', window.currentUser.id)
      .maybeSingle();
      
    if (error) throw error;
    
    updateProfileUI();
    await loadNotifications();
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// ===== PROFILE UPDATE =====
async function updateProfileUI() {
  const placeholder = document.getElementById('userProfilePlaceholder');
  const nameEl = document.getElementById('current-profile-name');
  const sidebarAvatar = document.getElementById('sidebar-profile-avatar');
  const sidebarName = document.getElementById('sidebar-profile-name');
  const sidebarEmail = document.getElementById('sidebar-profile-email');
  
  if (!placeholder || !nameEl) return;
  
  placeholder.innerHTML = '';
  
  if (window.currentUser) {
    try {
      if (!window.supabase) return;
      
      const { data: profile } = await window.supabase
        .from('user_profiles')
        .select('full_name, username, avatar_url')
        .eq('id', window.currentUser.id)
        .maybeSingle();
        
      const displayName = profile?.full_name || profile?.username || window.currentUser.email?.split('@')[0] || 'User';
      
      nameEl.textContent = displayName;
      if (sidebarName) sidebarName.textContent = displayName;
      if (sidebarEmail) sidebarEmail.textContent = window.currentUser.email || 'user@example.com';
      
      if (profile?.avatar_url) {
        const avatarUrl = fixMediaUrl(profile.avatar_url);
        const img = document.createElement('img');
        img.className = 'profile-img';
        img.src = avatarUrl;
        img.alt = displayName;
        img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
        
        img.onerror = () => {
          const fallback = document.createElement('div');
          fallback.className = 'profile-placeholder';
          fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
          fallback.textContent = getInitials(displayName);
          placeholder.innerHTML = '';
          placeholder.appendChild(fallback);
          if (sidebarAvatar) {
            sidebarAvatar.innerHTML = '';
            sidebarAvatar.appendChild(fallback.cloneNode(true));
          }
        };
        
        placeholder.appendChild(img);
        
        if (sidebarAvatar) {
          const sidebarImg = img.cloneNode(true);
          sidebarImg.onload = () => {
            sidebarAvatar.innerHTML = '';
            sidebarAvatar.appendChild(sidebarImg);
          };
          sidebarImg.onerror = () => {
            const fallback = document.createElement('div');
            fallback.className = 'profile-placeholder';
            fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
            fallback.textContent = getInitials(displayName);
            sidebarAvatar.innerHTML = '';
            sidebarAvatar.appendChild(fallback);
          };
        }
      } else {
        const fallback = document.createElement('div');
        fallback.className = 'profile-placeholder';
        fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
        fallback.textContent = getInitials(displayName);
        placeholder.appendChild(fallback);
        if (sidebarAvatar) {
          const sidebarFallback = fallback.cloneNode(true);
          sidebarAvatar.innerHTML = '';
          sidebarAvatar.appendChild(sidebarFallback);
        }
      }
    } catch (e) {
      console.warn('Profile fetch error:', e);
    }
  } else {
    nameEl.textContent = 'Guest';
    if (sidebarName) sidebarName.textContent = 'Guest';
    if (sidebarEmail) sidebarEmail.textContent = 'Sign in to continue';
    placeholder.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
    if (sidebarAvatar) sidebarAvatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
  }
}

// ===== AUTH STATE CHANGE =====
// Check if supabase exists before setting up auth listener
if (window.supabase && typeof window.supabase.auth.onAuthStateChange === 'function') {
  window.supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      window.currentUser = session.user;
      loadUserProfile();
      if (typeof showToast === 'function') {
        showToast('Welcome back!', 'success');
      }
    } else if (event === 'SIGNED_OUT') {
      window.currentUser = null;
      updateProfileUI();
      updateNotificationBadge(0);
      window.notifications = [];
      if (typeof showToast === 'function') {
        showToast('Signed out', 'info');
      }
    }
  });
} else {
  console.warn('⚠️ Supabase auth not available for state change listener');
}

// Make functions globally available
window.checkAuth = checkAuth;
window.loadUserProfile = loadUserProfile;
window.updateProfileUI = updateProfileUI;
