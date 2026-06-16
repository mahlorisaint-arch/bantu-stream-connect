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
    setTimeout(setupDescriptionExpandCollapse, 50);
    
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
    
    // Update aria-expanded
    if (expandBtn) expandBtn.setAttribute('aria-expanded', 'true');
    if (collapseBtn) collapseBtn.setAttribute('aria-expanded', 'true');
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
    
    // Update aria-expanded
    if (expandBtn) expandBtn.setAttribute('aria-expanded', 'false');
    if (collapseBtn) collapseBtn.setAttribute('aria-expanded', 'false');
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
    
    // Get the description from current content
    const description = window.currentContent?.description || '';
    const needsTruncation = description.length > 150;
    
    // If buttons don't exist, create them
    const actionsContainer = document.querySelector('.description-actions');
    if (actionsContainer) {
        // Check if buttons exist, if not create them
        if (!document.getElementById('expandDescriptionBtn')) {
            const newExpandBtn = document.createElement('button');
            newExpandBtn.id = 'expandDescriptionBtn';
            newExpandBtn.className = 'expand-btn';
            newExpandBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>Show More</span>';
            newExpandBtn.setAttribute('aria-expanded', 'false');
            actionsContainer.appendChild(newExpandBtn);
        }
        
        if (!document.getElementById('collapseDescriptionBtn')) {
            const newCollapseBtn = document.createElement('button');
            newCollapseBtn.id = 'collapseDescriptionBtn';
            newCollapseBtn.className = 'collapse-btn';
            newCollapseBtn.innerHTML = '<i class="fas fa-chevron-up"></i><span>Show Less</span>';
            newCollapseBtn.setAttribute('aria-expanded', 'true');
            actionsContainer.appendChild(newCollapseBtn);
        }
    }
    
    // Get fresh references after potential creation
    const expandBtnRef = document.getElementById('expandDescriptionBtn');
    const collapseBtnRef = document.getElementById('collapseDescriptionBtn');
    
    if (!expandBtnRef || !collapseBtnRef) {
        console.warn('Description expand/collapse buttons not found and could not be created');
        return;
    }
    
    // If description is short, hide expand button and show full description
    if (!needsTruncation) {
        expandBtnRef.style.display = 'none';
        collapseBtnRef.style.display = 'none';
        if (shortDesc) shortDesc.style.display = 'none';
        if (fullDesc) {
            fullDesc.textContent = description;
            fullDesc.style.display = 'block';
        }
        return;
    }
    
    // Remove existing listeners by cloning
    const newExpandBtn = expandBtnRef.cloneNode(true);
    expandBtnRef.parentNode.replaceChild(newExpandBtn, expandBtnRef);
    
    const newCollapseBtn = collapseBtnRef.cloneNode(true);
    collapseBtnRef.parentNode.replaceChild(newCollapseBtn, collapseBtnRef);
    
    // Setup expand button
    newExpandBtn.addEventListener('click', function(e) {
        e.preventDefault();
        renderFullDescription(description);
        
        // Announce to screen readers
        const liveRegion = document.getElementById('a11y-live-region') || document.querySelector('.a11y-live-region');
        if (liveRegion) {
            liveRegion.textContent = 'Description expanded, showing full content';
        }
    });
    
    // Setup collapse button
    newCollapseBtn.addEventListener('click', function(e) {
        e.preventDefault();
        renderShortDescription(description);
        
        // Announce to screen readers
        const liveRegion = document.getElementById('a11y-live-region') || document.querySelector('.a11y-live-region');
        if (liveRegion) {
            liveRegion.textContent = 'Description collapsed';
        }
    });
    
    // Setup keyboard accessibility
    newExpandBtn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
        }
    });
    
    newCollapseBtn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
        }
    });
    
    // Initialize with collapsed state if description is long
    if (needsTruncation) {
        renderShortDescription(description);
    } else {
        renderFullDescription(description);
    }
    
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
