/**
 * content-library-themes.js - Theme functionality for Content Library
 * Bantu Stream Connect
 */

// ============================================================================
// THEME FUNCTIONS
// ============================================================================

/**
 * Initialize theme based on saved preference or system preference
 */
function initTheme() {
    let savedTheme = localStorage.getItem('theme');
    
    if (!savedTheme) {
        savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    applyTheme(savedTheme);
}

/**
 * Apply theme to the document
 * @param {string} theme - Theme name (dark, light, high-contrast)
 */
function applyTheme(theme) {
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
    
    // Force repaint to ensure theme changes apply
    document.body.style.display = 'none';
    document.body.offsetHeight;
    document.body.style.display = '';
    
    // Dispatch theme change event for other components
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
}

/**
 * Get current theme
 * @returns {string} Current theme
 */
function getCurrentTheme() {
    if (document.body.classList.contains('theme-light')) return 'light';
    if (document.body.classList.contains('theme-high-contrast')) return 'high-contrast';
    return 'dark';
}

/**
 * Toggle between dark and light themes (skip high-contrast)
 */
function toggleTheme() {
    const currentTheme = getCurrentTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

/**
 * Setup theme event listeners
 */
function setupThemeEventListeners() {
    const themeToggle = document.getElementById('nav-theme-toggle');
    const themeSelector = document.getElementById('theme-selector');
    
    if (themeToggle && themeSelector) {
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
    
    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

/**
 * Add custom theme CSS variables dynamically
 * @param {Object} themeConfig - Custom theme configuration
 */
function addCustomTheme(themeName, themeConfig) {
    const style = document.createElement('style');
    style.id = `theme-${themeName}`;
    style.textContent = `
        body.theme-${themeName} {
            ${Object.entries(themeConfig).map(([key, value]) => `${key}: ${value};`).join('\n')}
        }
    `;
    document.head.appendChild(style);
    
    // Add theme option to selector
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        const button = document.createElement('button');
        button.className = 'theme-option';
        button.dataset.theme = themeName;
        button.innerHTML = `<i class="fas fa-paint-brush"></i> ${themeConfig.name || themeName}`;
        button.addEventListener('click', () => applyTheme(themeName));
        themeSelector.appendChild(button);
    }
}

// Initialize theme when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}
