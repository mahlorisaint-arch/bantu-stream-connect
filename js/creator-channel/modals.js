// ============================================
// MODALS - ANALYTICS, NOTIFICATIONS, BANNER, ABOUT
// ============================================

// ===== USE EXISTING SUPABASE CLIENT =====
const supabase = window.supabaseClient || window.supabase;

// ===== ANALYTICS FUNCTIONS =====
function initAnalyticsModal() {
  const modal = document.getElementById('analytics-modal');
  if (!modal) return;
  
  const analyticsBtn = document.getElementById('analytics-btn');
  if (analyticsBtn) {
    analyticsBtn.addEventListener('click', () => {
      modal.classList.add('active');
      loadChannelAnalytics();
    });
  }
  
  const closeBtn = document.getElementById('close-analytics');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }
  
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('active');
  });
}

async function loadChannelAnalytics() {
  if (!window.currentUser || !window.creatorContent) return;
  
  const totalViews = window.creatorContent.reduce((s,c) => s + (c.views_count || 0), 0);
  const totalLikes = window.creatorContent.reduce((s,c) => s + (c.likes_count || 0), 0);
  const engagement = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) + '%' : '0%';
  
  const viewsEl = document.getElementById('analytics-views');
  const connectorsEl = document.getElementById('analytics-connectors');
  const engagementEl = document.getElementById('analytics-engagement');
  const watchTimeEl = document.getElementById('analytics-watch-time');
  
  if (viewsEl) viewsEl.textContent = formatNumber(totalViews);
  if (connectorsEl) connectorsEl.textContent = formatNumber(window.connectorCount || 0);
  if (engagementEl) engagementEl.textContent = engagement;
  if (watchTimeEl) watchTimeEl.textContent = Math.floor(totalViews * 0.65 / 60) + 'm';
  
  const ctx = document.getElementById('channel-engagement-chart');
  if (!ctx) return;
  
  if (window._analyticsChart) window._analyticsChart.destroy();
  
  window._analyticsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Views',
          data: [65, 80, 50, 90, 110, 75, 120],
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245,158,11,0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Connects',
          data: [12, 19, 15, 25, 22, 30, 35],
          borderColor: '#1D4ED8',
          backgroundColor: 'rgba(29,78,216,0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: 'var(--soft-white)'
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: 'var(--slate-grey)' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: 'var(--slate-grey)' }
        }
      }
    }
  });
}

// ===== NOTIFICATIONS =====
async function loadNotifications() {
  try {
    if (!window.currentUser) {
      updateNotificationBadge(0);
      return;
    }
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) throw error;
    
    window.notifications = data || [];
    const unreadCount = window.notifications.filter(n => !n.is_read).length;
    updateNotificationBadge(unreadCount);
  } catch (error) {
    console.error('Error loading notifications:', error);
    updateNotificationBadge(0);
  }
}

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

function renderNotifications() {
  const list = document.getElementById('notifications-list');
  if (!list) return;
  
  if (!window.currentUser) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);"><i class="fas fa-bell-slash" style="font-size:48px;margin-bottom:15px;opacity:0.5;"></i><p>Sign in to see notifications</p></div>`;
    return;
  }
  
  if (!window.notifications || window.notifications.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);"><i class="fas fa-bell" style="font-size:48px;margin-bottom:15px;opacity:0.3;"></i><p>No notifications yet</p></div>`;
    return;
  }
  
  list.innerHTML = window.notifications.map(n => {
    const icon = getNotificationIcon(n.type);
    const readClass = n.is_read ? 'opacity:0.7;' : 'background:rgba(245,158,11,0.1);';
    const unreadDot = !n.is_read ? '<div style="width:10px;height:10px;border-radius:50%;background:var(--warm-gold);margin-top:5px;"></div>' : '';
    
    return `<div style="padding:15px;border-bottom:1px solid var(--card-border);${readClass}"><div style="display:flex;gap:12px;"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="${icon}" style="font-size:18px;"></i></div><div style="flex:1;"><div style="font-weight:600;margin-bottom:5px;color:var(--soft-white);">${escapeHtml(n.title)}</div><div style="font-size:14px;color:var(--slate-grey);margin-bottom:8px;">${escapeHtml(n.message)}</div><div style="font-size:12px;color:var(--warm-gold);">${formatNotificationTime(n.created_at)}</div></div>${unreadDot}</div></div>`;
  }).join('');
}

function getNotificationIcon(type) {
  switch(type) {
    case 'like': return 'fas fa-heart';
    case 'comment': return 'fas fa-comment';
    case 'follow': return 'fas fa-user-plus';
    default: return 'fas fa-bell';
  }
}

function formatNotificationTime(timestamp) {
  if (!timestamp) return 'Just now';
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMins = Math.floor(diffMs/60000);
  const diffHours = Math.floor(diffMs/3600000);
  const diffDays = Math.floor(diffMs/86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ===== EDIT ABOUT MODAL =====
function showEditAboutModal() {
  if (!window.currentUser || window.currentUser.id !== window.creatorId) {
    showToast('Only the channel owner can edit this section', 'warning');
    return;
  }
  
  const quoteInput = document.getElementById('edit-quote');
  const missionInput = document.getElementById('edit-mission');
  const locationInput = document.getElementById('edit-location');
  const websiteInput = document.getElementById('edit-website');
  const scheduleInput = document.getElementById('edit-schedule');
  const tagsInput = document.getElementById('edit-tags');
  const socialInput = document.getElementById('edit-social');
  const modal = document.getElementById('edit-about-modal');
  
  if (quoteInput) quoteInput.value = window.creatorProfile.quote || '';
  if (missionInput) missionInput.value = window.creatorProfile.mission || '';
  if (locationInput) locationInput.value = window.creatorProfile.location || '';
  if (websiteInput) websiteInput.value = window.creatorProfile.website_url || '';
  if (scheduleInput) scheduleInput.value = window.creatorProfile.upload_schedule || '';
  if (tagsInput) tagsInput.value = window.creatorProfile.interests || '';
  if (socialInput) socialInput.value = window.creatorProfile.social_links ? JSON.stringify(window.creatorProfile.social_links, null, 2) : '';
  
  if (modal) modal.classList.add('active');
}

function hideEditAboutModal() {
  const modal = document.getElementById('edit-about-modal');
  if (modal) modal.classList.remove('active');
}

async function saveAboutSection() {
  if (!window.currentUser || window.currentUser.id !== window.creatorId) {
    showToast('Only the channel owner can edit this section', 'warning');
    return;
  }
  
  try {
    const updates = { updated_at: new Date().toISOString() };
    
    const fields = [
      { id: 'edit-quote', key: 'quote' },
      { id: 'edit-mission', key: 'mission' },
      { id: 'edit-location', key: 'location' },
      { id: 'edit-website', key: 'website_url' },
      { id: 'edit-schedule', key: 'upload_schedule' },
      { id: 'edit-tags', key: 'interests' }
    ];
    
    fields.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el) {
        const val = el.value.trim();
        if (val) updates[key] = val;
      }
    });
    
    const socialInput = document.getElementById('edit-social');
    if (socialInput) {
      const socialValue = socialInput.value.trim();
      if (socialValue) {
        try {
          updates.social_links = JSON.parse(socialValue);
        } catch (e) {
          showToast('Invalid JSON for social links', 'warning');
          return;
        }
      }
    }
    
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', window.creatorId)
      .select()
      .single();
      
    if (error) throw error;
    
    if (data) window.creatorProfile = { ...window.creatorProfile, ...data };
    
    updateIdentityCard();
    hideEditAboutModal();
    showToast('About section updated successfully! ✨', 'success');
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed: ' + (error.message || error.hint || 'Unknown'), 'error');
  }
}

// ===== BANNER UPLOAD MODAL =====
function showBannerUploadModal() {
  if (!window.currentUser || window.currentUser.id !== window.creatorId) {
    showToast('Only the channel owner can change the banner', 'warning');
    return;
  }
  
  const modal = document.getElementById('banner-upload-modal');
  if (modal) modal.classList.add('active');
  
  const previewImg = document.getElementById('banner-preview-img');
  const placeholder = document.getElementById('banner-preview-placeholder');
  const urlInput = document.getElementById('banner-url-input');
  const progressContainer = document.getElementById('banner-upload-progress');
  
  if (previewImg) previewImg.style.display = 'none';
  if (placeholder) placeholder.style.display = 'flex';
  if (urlInput) urlInput.value = '';
  if (progressContainer) progressContainer.style.display = 'none';
}

function hideBannerUploadModal() {
  const modal = document.getElementById('banner-upload-modal');
  if (modal) modal.classList.remove('active');
}

// ===== BANNER UPLOAD HANDLER (EDGE FUNCTION + CLOUDFLARE R2) =====
async function handleBannerUpload(file) {
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!validTypes.includes(file.type)) {
    showToast('Please upload a valid image (JPEG, PNG, or WEBP)', 'error');
    return false;
  }
  
  // Validate file size (20MB max)
  const maxSize = 20 * 1024 * 1024; // 20MB
  if (file.size > maxSize) {
    showToast('Image must be less than 20MB', 'error');
    return false;
  }
  
  // Show progress indicator
  const progressContainer = document.getElementById('banner-upload-progress');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressText = document.getElementById('upload-progress-text');
  
  if (progressContainer) progressContainer.style.display = 'block';
  if (progressText) progressText.textContent = 'Requesting upload URL...';
  
  try {
    // Step 1: Get presigned upload URL from edge function
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke('get-upload-url', {
      body: { 
        mediaType: 'banner', 
        fileName: file.name 
      }
    });
    
    if (uploadError) throw new Error(uploadError.message);
    if (!uploadData?.uploadUrl) throw new Error('No upload URL received');
    
    // Step 2: Upload to Cloudflare R2
    if (progressText) progressText.textContent = 'Uploading to CDN...';
    
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadData.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && progressFill) {
        const percent = (e.loaded / e.total) * 100;
        progressFill.style.width = percent + '%';
        if (progressText) progressText.textContent = `Uploading: ${Math.round(percent)}%`;
      }
    };
    
    await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status === 200) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(file);
    });
    
    // Step 3: Save URL to database (channel_banner_url)
    if (progressText) progressText.textContent = 'Updating profile...';
    
    const { error: dbError } = await supabase
      .from('user_profiles')
      .update({ channel_banner_url: uploadData.fileUrl })
      .eq('id', window.creatorId);
      
    if (dbError) throw dbError;
    
    // Step 4: Update UI
    setBannerImage(uploadData.fileUrl);
    showToast('Banner updated successfully! 🎉', 'success');
    
    // Update local state
    if (window.creatorProfile) {
      window.creatorProfile.channel_banner_url = uploadData.fileUrl;
    }
    
    // Hide progress
    if (progressContainer) {
      setTimeout(() => {
        progressContainer.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
      }, 1000);
    }
    
    return true;
    
  } catch (error) {
    console.error('Banner upload error:', error);
    showToast('Failed to upload banner: ' + error.message, 'error');
    if (progressContainer) progressContainer.style.display = 'none';
    return false;
  }
}

// ===== FALLBACK BANNER UPLOAD =====
async function uploadBannerFallback(file) {
  try {
    const fileName = `banners/${window.creatorId}_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('channel-banners').upload(fileName, file);
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from('channel-banners').getPublicUrl(fileName);
    await supabase
      .from('user_profiles')
      .update({ channel_banner_url: publicUrl })
      .eq('id', window.creatorId);
      
    setBannerImage(publicUrl);
    showToast('Banner uploaded (using fallback storage)', 'success');
    return true;
  } catch (error) {
    console.error('Fallback upload error:', error);
    return false;
  }
}

// Make functions globally available
window.initAnalyticsModal = initAnalyticsModal;
window.loadChannelAnalytics = loadChannelAnalytics;
window.loadNotifications = loadNotifications;
window.updateNotificationBadge = updateNotificationBadge;
window.renderNotifications = renderNotifications;
window.showEditAboutModal = showEditAboutModal;
window.hideEditAboutModal = hideEditAboutModal;
window.saveAboutSection = saveAboutSection;
window.showBannerUploadModal = showBannerUploadModal;
window.hideBannerUploadModal = hideBannerUploadModal;
window.handleBannerUpload = handleBannerUpload;
window.uploadBannerFallback = uploadBannerFallback;
