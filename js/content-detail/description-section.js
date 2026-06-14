// js/content-detail/description-section.js
// ============================================
// DESCRIPTION SECTION MODULE
// Contains UI rendering for content description (full/short)
// AND its specific DOM interaction logic for expand/collapse
// ============================================
console.log('🎬 Description Section Module Loading...');

/**
 * Update description UI elements in the DOM
 * Sets both short (truncated) and full description text
 */
function updateDescriptionUI(content) {
    if (!content) return;
    
    const shortDescEl = document.getElementById('contentDescriptionShort');
    const fullDescEl = document.getElementById('contentDescriptionFull');
    
    if (shortDescEl) {
        shortDescEl.textContent = window.truncateText(content.description, 150);
    }
    
    if (fullDescEl) {
        fullDescEl.textContent = content.description || '';
    }
    
    console.log('✅ Description UI updated');
}

/**
 * Render full description (expanded view)
 * Called when user clicks "Show more"
 */
function renderFullDescription(description) {
    const container = document.getElementById('contentDescriptionFull');
    const expandBtn = document.getElementById('expandDescriptionBtn');
    const collapseBtn = document.getElementById('collapseDescriptionBtn');
    
    if (container) {
        container.textContent = description || '';
        container.style.display = 'block';
    }
    
    if (expandBtn) expandBtn.style.display = 'none';
    if (collapseBtn) collapseBtn.style.display = 'inline-flex';
}

/**
 * Render short description (collapsed view)
 * Called when user clicks "Show less"
 */
function renderShortDescription(description) {
    const container = document.getElementById('contentDescriptionShort');
    const expandBtn = document.getElementById('expandDescriptionBtn');
    const collapseBtn = document.getElementById('collapseDescriptionBtn');
    
    if (container) {
        container.textContent = window.truncateText(description, 150);
        container.style.display = 'block';
    }
    
    const fullContainer = document.getElementById('contentDescriptionFull');
    if (fullContainer) fullContainer.style.display = 'none';
    
    if (expandBtn) expandBtn.style.display = 'inline-flex';
    if (collapseBtn) collapseBtn.style.display = 'none';
}

/**
 * Setup description expand/collapse functionality
 * Toggles between short (150 char) and full description views
 * Also handles keyboard accessibility
 */
function setupDescriptionExpandCollapse() {
    const expandBtn = document.getElementById('expandDescriptionBtn');
    const collapseBtn = document.getElementById('collapseDescriptionBtn');
    const shortDesc = document.getElementById('contentDescriptionShort');
    const fullDesc = document.getElementById('contentDescriptionFull');
    
    if (!expandBtn || !collapseBtn) {
        console.warn('Description expand/collapse buttons not found');
        return;
    }
    
    // Get the description from current content
    const description = window.currentContent?.description || '';
    
    // Determine if description is long enough to need truncation
    const needsTruncation = description.length > 150;
    
    if (!needsTruncation) {
        // If description is short, hide expand button and show full description
        expandBtn.style.display = 'none';
        if (shortDesc) shortDesc.style.display = 'none';
        if (fullDesc) {
            fullDesc.textContent = description;
            fullDesc.style.display = 'block';
        }
        return;
    }
    
    // Setup expand button
    const newExpandBtn = expandBtn.cloneNode(true);
    expandBtn.parentNode.replaceChild(newExpandBtn, expandBtn);
    
    newExpandBtn.addEventListener('click', (e) => {
        e.preventDefault();
        renderFullDescription(description);
        
        // Announce to screen readers
        const liveRegion = document.getElementById('a11y-live-region');
        if (liveRegion) {
            liveRegion.textContent = 'Description expanded, showing full content';
        }
    });
    
    // Setup collapse button
    const newCollapseBtn = collapseBtn.cloneNode(true);
    collapseBtn.parentNode.replaceChild(newCollapseBtn, collapseBtn);
    
    newCollapseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        renderShortDescription(description);
        
        // Announce to screen readers
        const liveRegion = document.getElementById('a11y-live-region');
        if (liveRegion) {
            liveRegion.textContent = 'Description collapsed';
        }
    });
    
    // Initialize with collapsed state
    renderShortDescription(description);
    
    // Setup keyboard accessibility
    newExpandBtn.setAttribute('aria-expanded', 'false');
    newCollapseBtn.setAttribute('aria-expanded', 'true');
    
    newExpandBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            newExpandBtn.click();
        }
    });
    
    newCollapseBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            newCollapseBtn.click();
        }
    });
    
    console.log('✅ Description expand/collapse initialized');
}

/**
 * Toggle description visibility programmatically
 * @param {boolean} expand - True to expand, false to collapse
 */
function toggleDescription(expand) {
    const description = window.currentContent?.description || '';
    
    if (expand) {
        renderFullDescription(description);
    } else {
        renderShortDescription(description);
    }
}

/**
 * Update description when content changes
 * Called from setCurrentContent or playlist changes
 */
function refreshDescription() {
    if (window.currentContent) {
        updateDescriptionUI(window.currentContent);
    }
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.updateDescriptionUI = updateDescriptionUI;
window.renderFullDescription = renderFullDescription;
window.renderShortDescription = renderShortDescription;
window.setupDescriptionExpandCollapse = setupDescriptionExpandCollapse;
window.toggleDescription = toggleDescription;
window.refreshDescription = refreshDescription;

console.log('✅ Description Section Module loaded');
