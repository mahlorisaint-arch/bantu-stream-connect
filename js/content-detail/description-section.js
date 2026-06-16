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
    const description = content.description || '';
    
    if (shortDescEl) {
        shortDescEl.textContent = window.truncateText ? window.truncateText(description, 150) : description.substring(0, 150) + '...';
    }
    
    if (fullDescEl) {
        fullDescEl.textContent = description;
    }
    
    // Setup expand/collapse after updating content
    setTimeout(setupDescriptionExpandCollapse, 100);
    
    console.log('✅ Description UI updated');
}

/**
 * Render full description (expanded view)
 * Called when user clicks "Show more"
 */
function renderFullDescription(description) {
    const container = document.getElementById('contentDescriptionFull');
    const shortContainer = document.getElementById('contentDescriptionShort');
    const expandBtn = document.getElementById('expandDescriptionBtn');
    const collapseBtn = document.getElementById('collapseDescriptionBtn');
    const contentWrapper = document.querySelector('.description-content');
    
    if (container) {
        container.textContent = description || '';
        container.style.display = 'block';
    }
    
    if (shortContainer) {
        shortContainer.style.display = 'none';
    }
    
    if (expandBtn) {
        expandBtn.style.display = 'none';
    }
    
    if (collapseBtn) {
        collapseBtn.style.display = 'inline-flex';
    }
    
    if (contentWrapper) {
        contentWrapper.classList.remove('collapsed');
    }
}

/**
 * Render short description (collapsed view)
 * Called when user clicks "Show less"
 */
function renderShortDescription(description) {
    const container = document.getElementById('contentDescriptionShort');
    const fullContainer = document.getElementById('contentDescriptionFull');
    const expandBtn = document.getElementById('expandDescriptionBtn');
    const collapseBtn = document.getElementById('collapseDescriptionBtn');
    const contentWrapper = document.querySelector('.description-content');
    
    if (container) {
        const truncated = window.truncateText ? window.truncateText(description, 150) : description.substring(0, 150) + '...';
        container.textContent = truncated;
        container.style.display = 'block';
    }
    
    if (fullContainer) {
        fullContainer.style.display = 'none';
    }
    
    if (expandBtn) {
        expandBtn.style.display = 'inline-flex';
    }
    
    if (collapseBtn) {
        collapseBtn.style.display = 'none';
    }
    
    if (contentWrapper) {
        contentWrapper.classList.add('collapsed');
    }
}

/**
 * Setup description expand/collapse functionality
 * Toggles between short (150 char) and full description views
 */
function setupDescriptionExpandCollapse() {
    const expandBtn = document.getElementById('expandDescriptionBtn');
    const collapseBtn = document.getElementById('collapseDescriptionBtn');
    const shortDesc = document.getElementById('contentDescriptionShort');
    const fullDesc = document.getElementById('contentDescriptionFull');
    const contentWrapper = document.querySelector('.description-content');
    
    // Get the description from current content
    const description = window.currentContent?.description || '';
    const needsTruncation = description.length > 150;
    
    // If buttons don't exist, return
    if (!expandBtn || !collapseBtn) {
        console.warn('Description expand/collapse buttons not found in DOM');
        return;
    }
    
    // If description is short, hide buttons and show full description
    if (!needsTruncation) {
        expandBtn.style.display = 'none';
        collapseBtn.style.display = 'none';
        if (shortDesc) shortDesc.style.display = 'none';
        if (fullDesc) {
            fullDesc.textContent = description;
            fullDesc.style.display = 'block';
        }
        if (contentWrapper) {
            contentWrapper.classList.remove('has-truncation');
        }
        return;
    }
    
    // Add truncation class
    if (contentWrapper) {
        contentWrapper.classList.add('has-truncation');
    }
    
    // Remove existing listeners by cloning
    const newExpandBtn = expandBtn.cloneNode(true);
    expandBtn.parentNode.replaceChild(newExpandBtn, expandBtn);
    
    const newCollapseBtn = collapseBtn.cloneNode(true);
    collapseBtn.parentNode.replaceChild(newCollapseBtn, collapseBtn);
    
    // Setup expand button
    newExpandBtn.addEventListener('click', function(e) {
        e.preventDefault();
        renderFullDescription(description);
    });
    
    // Setup collapse button
    newCollapseBtn.addEventListener('click', function(e) {
        e.preventDefault();
        renderShortDescription(description);
    });
    
    // Initialize with collapsed state
    renderShortDescription(description);
    
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
