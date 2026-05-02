document.addEventListener('DOMContentLoaded', () => {
  setupSidebar();
  setupNavigation();
  setupProfileUI();
});

// 📱 Sidebar Toggle Logic
function setupSidebar() {
  const toggle = document.getElementById('menu-toggle');
  const closeBtn = document.getElementById('sidebar-close');
  const sidebar = document.getElementById('sidebar-menu');
  const overlay = document.getElementById('sidebar-overlay');
  const openSidebar = () => { sidebar?.classList.add('active'); overlay?.classList.add('active'); };
  const closeSidebar = () => { sidebar?.classList.remove('active'); overlay?.classList.remove('active'); };
  
  toggle?.addEventListener('click', (e) => { e.preventDefault(); openSidebar(); });
  closeBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });
}

// 🧭 Navigation & Active State
function setupNavigation() {
  const currentPage = window.location.pathname.split('/').pop();
  const links = document.querySelectorAll('.sidebar-nav-item');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
      const section = link.closest('.sidebar-section');
      if (section) section.querySelector('.sidebar-section-items').classList.remove('collapsed');
    }
  });

  // Bottom Nav
  document.getElementById('nav-home-btn')?.addEventListener('click', () => window.location.href = 'index.html');
  document.getElementById('nav-create-btn')?.addEventListener('click', () => window.location.href = 'creator-upload.html');
  document.getElementById('nav-history-btn')?.addEventListener('click', () => window.location.href = 'watch-history.html');
  document.getElementById('nav-menu-btn')?.addEventListener('click', () => document.getElementById('sidebar-menu')?.classList.add('active'));
}

// 👤 Profile & Auth Integration
function setupProfileUI() {
  const updateProfile = (type, name, avatarUrl) => {
    const headerName = document.getElementById('current-profile-name');
    const sidebarName = document.getElementById('sidebar-profile-name');
    const headerAvatar = document.querySelector('#userProfilePlaceholder');
    const sidebarAvatar = document.querySelector('#sidebar-profile-avatar');
    
    if (headerName) headerName.textContent = name;
    if (sidebarName) sidebarName.textContent = name;
    
    const avatarHTML = `<img src="${avatarUrl}" alt="${name}" onerror="this.style.display='none'">`;
    if (headerAvatar) headerAvatar.innerHTML = avatarHTML;
    if (sidebarAvatar) sidebarAvatar.innerHTML = avatarHTML;
  };

  // Example: Call this after your AuthHelper loads
  // if (window.AuthHelper.isAuthenticated()) updateProfile('main', window.AuthHelper.getDisplayName(), window.AuthHelper.getAvatarUrl());
}
