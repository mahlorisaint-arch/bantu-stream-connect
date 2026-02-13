/**
 * Theme Management Module
 * Handles theme initialization, application, and persistence
 */

// Initialize theme from localStorage or system preference
function initTheme() {
  let savedTheme = localStorage.getItem('theme');
  if (!savedTheme) {
    savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(savedTheme);
}

// Apply theme to the document body
function applyTheme(theme) {
  if (!theme || !['dark', 'light', 'high-contrast'].includes(theme)) {
    theme = 'dark';
  }
  
  // Remove all theme classes
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
  
  // Add the selected theme class
  document.body.classList.add(`theme-${theme}`);
  
  // Save to localStorage
  localStorage.setItem('theme', theme);
  
  // Update UI to reflect active theme
  document.querySelectorAll('.theme-option').forEach(option => {
    option.classList.toggle('active', option.dataset.theme === theme);
  });
  
  // Force repaint to avoid transition on initial load
  document.body.style.display = 'none';
  document.body.offsetHeight; // Trigger reflow
  document.body.style.display = '';
}

// Setup theme-related event listeners
function setupThemeListeners() {
  const themeToggle = document.getElementById('nav-theme-toggle');
  const themeSelector = document.getElementById('theme-selector');
  
  if (themeToggle && themeSelector) {
    // Toggle theme selector visibility
    themeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      themeSelector.classList.toggle('active');
    });
    
    // Close selector when clicking outside
    document.addEventListener('click', (e) => {
      if (themeSelector.classList.contains('active') &&
          !themeSelector.contains(e.target) &&
          !themeToggle.contains(e.target)) {
        themeSelector.classList.remove('active');
      }
    });
    
    // Apply theme when option selected
    document.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', () => {
        applyTheme(option.dataset.theme);
        themeSelector.classList.remove('active');
      });
    });
  }
}
