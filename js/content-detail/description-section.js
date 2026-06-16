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
    setTimeout(function() {
        setupDescriptionExpandCollapse();
    }, 100);
    
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
    
    console.log('📖 Description expanded');
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
    
    console.log('📖 Description collapsed');
}

/**
 * Setup description expand/collapse functionality
 * Toggles between short (150 char) and full description views
 * FORCES creation of buttons if they don't exist
 */
function setupDescriptionExpandCollapse() {
    console.log('🔧 Setting up description expand/collapse...');
    
    // Get the description from current content
    const description = window.currentContent?.description || '';
    const needsTruncation = description.length > 150;
    
    console.log('📝 Description length:', description.length, 'Needs truncation:', needsTruncation);
    
    // Find or create the actions container
    let actionsContainer = document.querySelector('.description-actions');
    const contentWrapper = document.querySelector('.description-content');
    
    // If .description-actions doesn't exist, create it
    if (!actionsContainer) {
        console.log('⚠️ .description-actions not found, creating it...');
        actionsContainer = document.createElement('div');
        actionsContainer.className = 'description-actions';
        
        // Find where to insert it
        const descriptionContent = document.querySelector('.description-content');
        if (descriptionContent) {
            descriptionContent.appendChild(actionsContainer);
        } else {
            // Fallback: insert after the description section
            const descSection = document.querySelector('.description-section');
            if (descSection) {
                const container = document.createElement('div');
                container.className = 'description-content';
                container.appendChild(actionsContainer);
                descSection.appendChild(container);
            }
        }
    }
    
    // Check if buttons exist, if not create them
    let expandBtn = document.getElementById('expandDescriptionBtn');
    let collapseBtn = document.getElementById('collapseDescriptionBtn');
    
    if (!expandBtn) {
        console.log('⚠️ #expandDescriptionBtn not found, creating it...');
        expandBtn = document.createElement('button');
        expandBtn.id = 'expandDescriptionBtn';
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>Show More</span>';
        expandBtn.style.display = 'none';
        actionsContainer.appendChild(expandBtn);
    }
    
    if (!collapseBtn) {
        console.log('⚠️ #collapseDescriptionBtn not found, creating it...');
        collapseBtn = document.createElement('button');
        collapseBtn.id = 'collapseDescriptionBtn';
        collapseBtn.className = 'collapse-btn';
        collapseBtn.innerHTML = '<i class="fas fa-chevron-up"></i><span>Show Less</span>';
        collapseBtn.style.display = 'none';
        actionsContainer.appendChild(collapseBtn);
    }
    
    // Get fresh references
    expandBtn = document.getElementById('expandDescriptionBtn');
    collapseBtn = document.getElementById('collapseDescriptionBtn');
    
    if (!expandBtn || !collapseBtn) {
        console.error('❌ Failed to create expand/collapse buttons');
        return;
    }
    
    // If description is short, hide buttons and show full description
    if (!needsTruncation) {
        expandBtn.style.display = 'none';
        collapseBtn.style.display = 'none';
        const shortDesc = document.getElementById('contentDescriptionShort');
        const fullDesc = document.getElementById('contentDescriptionFull');
        if (shortDesc) shortDesc.style.display = 'none';
        if (fullDesc) {
            fullDesc.textContent = description;
            fullDesc.style.display = 'block';
        }
        if (contentWrapper) {
            contentWrapper.classList.remove('has-truncation');
        }
        console.log('✅ Description is short, hiding buttons');
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
        e.stopPropagation();
        console.log('🔄 Show More clicked');
        renderFullDescription(description);
    });
    
    // Setup collapse button
    newCollapseBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔄 Show Less clicked');
        renderShortDescription(description);
    });
    
    // Initialize with collapsed state
    renderShortDescription(description);
    
    console.log('✅ Description expand/collapse initialized successfully');
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
    console.log('🔄 Refreshing description...');
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

// ============================================
// AUTO-INITIALIZATION
// ============================================
// Try to initialize when content is ready
function attemptInit() {
    if (window.currentContent) {
        console.log('🎬 Auto-initializing description section...');
        setTimeout(function() {
            updateDescriptionUI(window.currentContent);
        }, 200);
        return true;
    }
    return false;
}

// Listen for content changes
document.addEventListener('contentIdChanged', function() {
    console.log('🔄 Content changed, refreshing description...');
    setTimeout(function() {
        refreshDescription();
    }, 300);
});

// Listen for playlist loaded
document.addEventListener('playlistLoaded', function() {
    console.log('🔄 Playlist loaded, refreshing description...');
    setTimeout(function() {
        refreshDescription();
    }, 300);
});

// Initial attempt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            if (!attemptInit()) {
                setTimeout(attemptInit, 1000);
            }
        }, 500);
    });
} else {
    setTimeout(function() {
        if (!attemptInit()) {
            setTimeout(attemptInit, 1000);
        }
    }, 500);
}

console.log('✅ Description Section Module loaded');
