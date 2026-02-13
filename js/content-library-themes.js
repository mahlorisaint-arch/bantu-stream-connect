/**
 * CONTENT LIBRARY - THEMES MODULE
 * Bantu Stream Connect
 * 
 * Handles theme switching and preferences
 */

// ============================================
// THEME FUNCTIONS
// ============================================

/**
 * Initialize theme system
 */
export function initTheme() {
    let savedTheme = localStorage.getItem('theme');
    
    if (!savedTheme) {
        savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    applyTheme(savedTheme);
    setupThemeToggle();
}

/**
 * Apply theme to document
 */
export function applyTheme(theme) {
    if (!theme || !['dark', 'light', 'high-contrast'].includes(theme)) {
        theme = 'dark';
    }
    
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    document.body.classList.add(`theme-${theme}`);
    
    localStorage.setItem('theme', theme);
    
    // Update active state in theme selector
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('active', option.dataset.theme === theme);
    });
    
    // Force repaint to ensure styles apply
    document.body.style.display = 'none';
    document.body.offsetHeight;
    document.body.style.display = '';
}

/**
 * Setup theme toggle button and selector
 */
function setupThemeToggle() {
    const themeToggle = document.getElementById('nav-theme-toggle');
    const themeSelector = document.getElementById('theme-selector');
    
    if (!themeToggle || !themeSelector) return;
    
    themeToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        themeSelector.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
        if (themeSelector.classList.contains('active') && 
            !themeSelector.contains(e.target) && 
            !themeToggle.contains(e.target)) {
            themeSelector.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
            applyTheme(option.dataset.theme);
            themeSelector.classList.remove('active');
        });
    });
}

/**
 * Get current theme
 */
export function getCurrentTheme() {
    if (document.body.classList.contains('theme-light')) return 'light';
    if (document.body.classList.contains('theme-high-contrast')) return 'high-contrast';
    return 'dark';
}

/**
 * Toggle between themes (for quick toggle)
 */
export function toggleTheme() {
    const current = getCurrentTheme();
    const themes = ['dark', 'light', 'high-contrast'];
    const currentIndex = themes.indexOf(current);
    const nextIndex = (currentIndex + 1) % themes.length;
    applyTheme(themes[nextIndex]);
}
