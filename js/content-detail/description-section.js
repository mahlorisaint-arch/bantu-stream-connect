// js/content-detail/description-section.js
// ============================================
// DESCRIPTION SECTION MODULE - COMPLETE FIX
// ============================================
console.log('🎬 Description Section Module Loading...');

/**
 * Update description UI elements in the DOM
 */
function updateDescriptionUI(content) {
    if (!content) return;
    
    const shortDescEl = document.getElementById('descShort');
    const fullDescEl = document.getElementById('descFull');
    const description = content.description || '';
    
    console.log('📝 Updating description UI, length:', description.length);
    
    if (shortDescEl) {
        shortDescEl.textContent = window.truncateText ? window.truncateText(description, 150) : description.substring(0, 150) + '...';
    }
    
    if (fullDescEl) {
        fullDescEl.textContent = description;
    }
    
    // Force setup expand/collapse after a delay
    setTimeout(function() {
        setupDescriptionExpandCollapse();
    }, 200);
    
    console.log('✅ Description UI updated');
}

/**
 * Render full description (expanded view)
 */
function renderFullDescription(description) {
    const container = document.getElementById('descFull');
    const shortContainer = document.getElementById('descShort');
    const expandBtn = document.getElementById('expandDescBtn');
    const collapseBtn = document.getElementById('collapseDescBtn');
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
 */
function renderShortDescription(description) {
    const container = document.getElementById('descShort');
    const fullContainer = document.getElementById('descFull');
    const expandBtn = document.getElementById('expandDescBtn');
    const collapseBtn = document.getElementById('collapseDescBtn');
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
 * Setup description expand/collapse functionality - FORCED
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
        
        const descriptionContent = document.querySelector('.description-content');
        if (descriptionContent) {
            descriptionContent.appendChild(actionsContainer);
        } else {
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
    let expandBtn = document.getElementById('expandDescBtn');
    let collapseBtn = document.getElementById('collapseDescBtn');
    
    if (!expandBtn) {
        console.log('⚠️ #expandDescBtn not found, creating it...');
        expandBtn = document.createElement('button');
        expandBtn.id = 'expandDescBtn';
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>Show More</span>';
        expandBtn.style.display = 'none';
        if (actionsContainer) actionsContainer.appendChild(expandBtn);
    }
    
    if (!collapseBtn) {
        console.log('⚠️ #collapseDescBtn not found, creating it...');
        collapseBtn = document.createElement('button');
        collapseBtn.id = 'collapseDescBtn';
        collapseBtn.className = 'collapse-btn';
        collapseBtn.innerHTML = '<i class="fas fa-chevron-up"></i><span>Show Less</span>';
        collapseBtn.style.display = 'none';
        if (actionsContainer) actionsContainer.appendChild(collapseBtn);
    }
    
    // Get fresh references
    expandBtn = document.getElementById('expandDescBtn');
    collapseBtn = document.getElementById('collapseDescBtn');
    
    if (!expandBtn || !collapseBtn) {
        console.error('❌ Failed to create expand/collapse buttons');
        return;
    }
    
    // If description is short, hide buttons
    if (!needsTruncation) {
        expandBtn.style.display = 'none';
        collapseBtn.style.display = 'none';
        const shortDesc = document.getElementById('descShort');
        const fullDesc = document.getElementById('descFull');
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
 * Toggle description visibility
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
 * Refresh description
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
// FORCED AUTO-INITIALIZATION - INDEPENDENT
// ============================================
function forceInit() {
    console.log('🎬 Forcing description section init...');
    if (window.currentContent) {
        setTimeout(function() {
            updateDescriptionUI(window.currentContent);
        }, 300);
        return true;
    }
    return false;
}

// Listen for content changes
document.addEventListener('contentIdChanged', function() {
    console.log('🔄 Content changed, refreshing description...');
    setTimeout(refreshDescription, 400);
});

document.addEventListener('playlistLoaded', function() {
    console.log('🔄 Playlist loaded, refreshing description...');
    setTimeout(refreshDescription, 400);
});

// Listen for auth changes (user signs in/out)
document.addEventListener('authStateChanged', function() {
    console.log('🔄 Auth state changed, refreshing description...');
    setTimeout(refreshDescription, 500);
});

// Initial attempt - multiple attempts to ensure it works
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            if (!forceInit()) {
                setTimeout(forceInit, 1000);
                setTimeout(forceInit, 2000);
            }
        }, 500);
    });
} else {
    setTimeout(function() {
        if (!forceInit()) {
            setTimeout(forceInit, 1000);
            setTimeout(forceInit, 2000);
        }
    }, 500);
}

console.log('✅ Description Section Module loaded (with forced init)');
