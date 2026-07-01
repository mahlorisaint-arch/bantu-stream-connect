// ============================================
// EVENTS-LISTENERS - ALL EVENT BINDINGS
// ============================================

// ===== SETUP ALL EVENT LISTENERS =====
function setupEventListeners() {
  // Profile button
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', async () => {
      const { data } = await supabase.auth.getSession();
      data?.session ? window.location.href = 'profile.html' : window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    });
  }
  
  const currentProfileBtn = document.getElementById('current-profile-btn');
  if (currentProfileBtn) {
    currentProfileBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById('profile-dropdown');
      if (dropdown) dropdown.classList.toggle('active');
    });
  }
  
  const manageProfilesBtn = document.getElementById('manage-profiles-btn');
  if (manageProfilesBtn) {
    manageProfilesBtn.addEventListener('click', () => {
      window.location.href = 'manage-profiles.html';
    });
  }
  
  document.addEventListener('click', (e) => {
    const profileBtnEl = document.getElementById('profile-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const currentProfileBtnEl = document.getElementById('current-profile-btn');
    
    if (profileDropdown && profileBtnEl && currentProfileBtnEl) {
      if (!profileBtnEl.contains(e.target) && !profileDropdown.contains(e.target) && !currentProfileBtnEl.contains(e.target)) {
        profileDropdown.classList.remove('active');
      }
    }
  });
  
  // Banner edit button
  const bannerEditBtn = document.getElementById('banner-edit-btn');
  if (bannerEditBtn) bannerEditBtn.addEventListener('click', showBannerUploadModal);
  
  // Banner file upload
  const bannerFileUpload = document.getElementById('banner-file-upload');
  const bannerFileInput = document.getElementById('banner-file-input');
  if (bannerFileUpload && bannerFileInput) {
    bannerFileUpload.addEventListener('click', () => { 
      bannerFileInput.click(); 
    });
    
    bannerFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const previewImg = document.getElementById('banner-preview-img');
        const placeholder = document.getElementById('banner-preview-placeholder');
        if (previewImg && placeholder) {
          previewImg.src = event.target.result;
          previewImg.style.display = 'block';
          placeholder.style.display = 'none';
        }
      };
      reader.readAsDataURL(file);
      
      await handleBannerUpload(file);
      e.target.value = '';
    });
  }
  
  // Banner URL apply
  const bannerUrlApply = document.getElementById('banner-url-apply');
  if (bannerUrlApply) {
    bannerUrlApply.addEventListener('click', async () => {
      const url = document.getElementById('banner-url-input')?.value.trim();
      if (!url) {
        showToast('Please enter a URL', 'warning');
        return;
      }
      
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
          showToast('URL must point to an image', 'error');
          return;
        }
        
        const contentLength = parseInt(response.headers.get('content-length'));
        const maxSize = 20 * 1024 * 1024;
        if (contentLength > maxSize) {
          showToast('Image must be less than 20MB', 'error');
          return;
        }
      } catch (error) {
        showToast('Could not validate image URL', 'error');
        return;
      }
      
      const previewImg = document.getElementById('banner-preview-img');
      const placeholder = document.getElementById('banner-preview-placeholder');
      if (previewImg && placeholder) {
        previewImg.src = url;
        previewImg.onload = () => {
          previewImg.style.display = 'block';
          placeholder.style.display = 'none';
        };
        previewImg.onerror = () => {
          showToast('Failed to load image from URL', 'error');
        };
      }
    });
  }
  
  // Banner save
  const bannerSave = document.getElementById('banner-save');
  if (bannerSave) {
    bannerSave.addEventListener('click', async () => {
      const previewImg = document.getElementById('banner-preview-img');
      if (previewImg && previewImg.style.display === 'block' && previewImg.src) {
        if (previewImg.src.startsWith('data:image')) {
          const response = await fetch(previewImg.src);
          const blob = await response.blob();
          const file = new File([blob], 'banner.jpg', { type: blob.type });
          await handleBannerUpload(file);
        } else {
          try {
            const { error: dbError } = await supabase
              .from('user_profiles')
              .update({ channel_banner_url: previewImg.src })
              .eq('id', window.creatorId);
              
            if (dbError) throw dbError;
            
            setBannerImage(previewImg.src);
            showToast('Banner updated successfully! 🎉', 'success');
            hideBannerUploadModal();
          } catch (error) {
            console.error('Error saving banner:', error);
            showToast('Failed to save banner', 'error');
          }
        }
      } else {
        showToast('Please select or enter an image first', 'warning');
      }
    });
  }
  
  // Banner cancel
  const bannerCancel = document.getElementById('banner-cancel');
  if (bannerCancel) bannerCancel.addEventListener('click', hideBannerUploadModal);
  
  // Edit identity button
  const editIdentityBtn = document.getElementById('edit-identity-btn');
  if (editIdentityBtn) editIdentityBtn.addEventListener('click', showEditAboutModal);
  
  // Cancel about button
  const cancelAboutBtn = document.getElementById('cancel-about-btn');
  if (cancelAboutBtn) cancelAboutBtn.addEventListener('click', hideEditAboutModal);
  
  // Save about button
  const saveAboutBtn = document.getElementById('save-about-btn');
  if (saveAboutBtn) saveAboutBtn.addEventListener('click', saveAboutSection);
  
  // Search modal
  const searchBtn = document.getElementById('search-btn');
  const closeSearchBtn = document.getElementById('close-search-btn');
  const searchModal = document.getElementById('search-modal');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      if (searchModal) searchModal.classList.add('active');
      setTimeout(() => document.getElementById('search-input')?.focus(), 300);
    });
  }
  
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
      if (searchModal) searchModal.classList.remove('active');
      const searchInputEl = document.getElementById('search-input');
      const searchResultsGrid = document.getElementById('search-results-grid');
      if (searchInputEl) searchInputEl.value = '';
      if (searchResultsGrid) searchResultsGrid.innerHTML = '';
    });
  }
  
  if (searchModal) {
    searchModal.addEventListener('click', e => {
      if (e.target === searchModal) {
        searchModal.classList.remove('active');
        const searchInputEl = document.getElementById('search-input');
        const searchResultsGrid = document.getElementById('search-results-grid');
        if (searchInputEl) searchInputEl.value = '';
        if (searchResultsGrid) searchResultsGrid.innerHTML = '';
      }
    });
  }
  
  const searchInputElement = document.getElementById('search-input');
  if (searchInputElement) {
    let timeout;
    searchInputElement.addEventListener('input', e => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        const query = e.target.value.trim();
        if (query.length < 2) {
          const resultsGrid = document.getElementById('search-results-grid');
          if (resultsGrid) resultsGrid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey);">Start typing to search...</div>';
          return;
        }
        
        const resultsGrid = document.getElementById('search-results-grid');
        if (resultsGrid) {
          resultsGrid.innerHTML = `<div style="text-align:center;padding:40px;"><div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-radius:50%;border-top-color:var(--warm-gold);animation:spin 1s linear infinite;margin:0 auto 15px;"></div><div style="color:var(--slate-grey);">Searching...</div></div>`;
        }
        
        const categoryFilter = document.getElementById('category-filter')?.value;
        const sortFilter = document.getElementById('sort-filter')?.value;
        const results = await searchContent(query, categoryFilter, sortFilter);
        renderSearchResults(results);
      }, 300);
    });
  }
  
  const categoryFilter = document.getElementById('category-filter');
  const sortFilter = document.getElementById('sort-filter');
  
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      if (searchInputElement && searchInputElement.value.trim().length >= 2) {
        searchInputElement.dispatchEvent(new Event('input'));
      }
    });
  }
  
  if (sortFilter) {
    sortFilter.addEventListener('change', () => {
      if (searchInputElement && searchInputElement.value.trim().length >= 2) {
        searchInputElement.dispatchEvent(new Event('input'));
      }
    });
  }
  
  // Share button
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) shareBtn.addEventListener('click', handleShare);
  
  // Support buttons
  const supportBtn = document.getElementById('support-btn');
  if (supportBtn) supportBtn.addEventListener('click', () => { showToast('Support feature coming soon!', 'info'); });
  
  const tipBtn = document.getElementById('tip-btn');
  if (tipBtn) tipBtn.addEventListener('click', () => { showToast('Tips feature coming soon!', 'info'); });
  
  const membershipBtn = document.getElementById('membership-btn');
  if (membershipBtn) membershipBtn.addEventListener('click', () => { showToast('Memberships feature coming soon!', 'info'); });
  
  // Connectors stat card
  const connectorsStatCard = document.getElementById('connectors-stat-card');
  if (connectorsStatCard) connectorsStatCard.addEventListener('click', showConnectorsModal);
  
  // Close modal button
  const closeModalBtn = document.getElementById('close-modal-btn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      const modal = document.getElementById('connectors-modal');
      if (modal) modal.classList.remove('active');
    });
  }
  
  const connectorsModal = document.getElementById('connectors-modal');
  if (connectorsModal) {
    connectorsModal.addEventListener('click', e => {
      if (e.target === connectorsModal) connectorsModal.classList.remove('active');
    });
  }
  
  // Notifications
  const notificationsBtn = document.getElementById('notifications-btn');
  if (notificationsBtn) {
    notificationsBtn.addEventListener('click', () => {
      const panel = document.getElementById('notifications-panel');
      if (panel) panel.classList.add('active');
      renderNotifications();
    });
  }
  
  const closeNotifications = document.getElementById('close-notifications');
  if (closeNotifications) {
    closeNotifications.addEventListener('click', () => {
      const panel = document.getElementById('notifications-panel');
      if (panel) panel.classList.remove('active');
    });
  }
  
  const notificationsPanel = document.getElementById('notifications-panel');
  if (notificationsPanel) {
    notificationsPanel.addEventListener('click', e => {
      if (e.target === notificationsPanel) notificationsPanel.classList.remove('active');
    });
  }
  
  const markAllRead = document.getElementById('mark-all-read');
  if (markAllRead) {
    markAllRead.addEventListener('click', async () => {
      if (!window.currentUser) return;
      try {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', window.currentUser.id).eq('is_read', false);
        if (error) throw error;
        window.notifications = window.notifications.map(n => ({ ...n, is_read: true }));
        renderNotifications();
        updateNotificationBadge(0);
        showToast('All notifications marked as read', 'success');
      } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('Failed to mark notifications as read', 'error');
      }
    });
  }
  
  // Sidebar nav items
  const sidebarCreate = document.getElementById('sidebar-create');
  if (sidebarCreate) {
    sidebarCreate.addEventListener('click', async (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        showToast('Please sign in to upload content', 'warning');
        window.location.href = `login.html?redirect=creator-upload.html`;
      } else {
        window.location.href = 'creator-upload.html';
      }
    });
  }
  
  const sidebarDashboard = document.getElementById('sidebar-dashboard');
  if (sidebarDashboard) {
    sidebarDashboard.addEventListener('click', async (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        showToast('Please sign in to access dashboard', 'warning');
        window.location.href = `login.html?redirect=creator-dashboard.html`;
      } else {
        window.location.href = 'creator-dashboard.html';
      }
    });
  }
  
  const sidebarWatchHistory = document.getElementById('sidebar-watch-history');
  if (sidebarWatchHistory) {
    sidebarWatchHistory.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      if (!window.currentUser) {
        showToast('Please sign in to view watch history', 'warning');
        window.location.href = `login.html?redirect=watch-history.html`;
        return;
      }
      window.location.href = 'watch-history.html';
    });
  }
  
  const sidebarAnalytics = document.getElementById('sidebar-analytics');
  if (sidebarAnalytics) {
    sidebarAnalytics.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const modal = document.getElementById('analytics-modal');
      if (modal) modal.classList.add('active');
      loadChannelAnalytics();
    });
  }
  
  const sidebarNotifications = document.getElementById('sidebar-notifications');
  if (sidebarNotifications) {
    sidebarNotifications.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const panel = document.getElementById('notifications-panel');
      if (panel) panel.classList.add('active');
      renderNotifications();
    });
  }
  
  const sidebarBadges = document.getElementById('sidebar-badges');
  if (sidebarBadges) {
    sidebarBadges.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      showToast('Badges coming soon!', 'info');
    });
  }
  
  const sidebarWatchParty = document.getElementById('sidebar-watch-party');
  if (sidebarWatchParty) {
    sidebarWatchParty.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      showToast('Watch Party coming soon!', 'info');
    });
  }
  
  // Voice search
  const voiceSearchBtn = document.getElementById('voice-search-btn');
  if (voiceSearchBtn) {
    voiceSearchBtn.addEventListener('click', () => {
      showToast('Voice search coming soon!', 'info');
    });
  }
  
  // Analytics & Playlist builder - already initialized elsewhere
  initAnalyticsModal();
  initPlaylistBuilder();
}

// Make functions globally available
window.setupEventListeners = setupEventListeners;
