// js/content-detail/description-section.js
// Extracted from content-detail.js - Description Section Management

console.log('📝 Description Section module loading...');

// ============================================
// UPDATE DESCRIPTION UI
// ============================================
function updateDescriptionUI(content) {
    if (!content) return;
    
    // Short description (for hero section)
    const shortDescEl = document.getElementById('contentDescriptionShort');
    if (shortDescEl) {
        shortDescEl.textContent = truncateText(content.description, 150);
    }
    
    // Full description (for description section)
    const fullDescEl = document.getElementById('contentDescriptionFull');
    if (fullDescEl) {
        fullDescEl.textContent = content.description || 'No description available.';
    }
    
    console.log('✅ Description UI updated');
}

// ============================================
// SETUP DESCRIPTION EXPAND/COLLAPSE (if needed)
// ============================================
function setupDescriptionExpandCollapse() {
    const descriptionContent = document.getElementById('contentDescriptionFull');
    const descriptionSection = document.querySelector('.description-section');
    
    if (!descriptionContent || !descriptionSection) return;
    
    // Check if description is long enough to need truncation
    const fullText = descriptionContent.textContent || '';
    const needsTruncation = fullText.length > 300;
    
    if (needsTruncation) {
        // Create expand/collapse button if it doesn't exist
        if (!document.getElementById('descExpandBtn')) {
            const expandBtn = document.createElement('button');
            expandBtn.id = 'descExpandBtn';
            expandBtn.className = 'desc-expand-btn';
            expandBtn.innerHTML = '<span>Show more</span> <i class="fas fa-chevron-down"></i>';
            
            let isExpanded = false;
            
            expandBtn.addEventListener('click', () => {
                if (isExpanded) {
                    descriptionContent.style.maxHeight = '100px';
                    descriptionContent.style.overflow = 'hidden';
                    expandBtn.innerHTML = '<span>Show more</span> <i class="fas fa-chevron-down"></i>';
                    isExpanded = false;
                } else {
                    descriptionContent.style.maxHeight = 'none';
                    descriptionContent.style.overflow = 'visible';
                    expandBtn.innerHTML = '<span>Show less</span> <i class="fas fa-chevron-up"></i>';
                    isExpanded = true;
                }
            });
            
            // Initially truncate
            descriptionContent.style.maxHeight = '100px';
            descriptionContent.style.overflow = 'hidden';
            
            descriptionSection.appendChild(expandBtn);
        }
    } else {
        // Remove expand button if it exists and description is short
        const existingBtn = document.getElementById('descExpandBtn');
        if (existingBtn) {
            existingBtn.remove();
        }
        descriptionContent.style.maxHeight = 'none';
        descriptionContent.style.overflow = 'visible';
    }
}

// ============================================
// RENDER FULL DESCRIPTION (alias)
// ============================================
function renderFullDescription(description) {
    const container = document.getElementById('contentDescriptionFull');
    if (container) {
        container.textContent = description || 'No description available.';
    }
}

// ============================================
// RENDER SHORT DESCRIPTION (alias)
// ============================================
function renderShortDescription(description) {
    const container = document.getElementById('contentDescriptionShort');
    if (container) {
        container.textContent = truncateText(description, 150);
    }
}

// ============================================
// TRUNCATE TEXT UTILITY
// ============================================
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ============================================
// ESCAPE HTML UTILITY
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// EXPORTS FOR GLOBAL ACCESS
// ============================================
window.updateDescriptionUI = updateDescriptionUI;
window.setupDescriptionExpandCollapse = setupDescriptionExpandCollapse;
window.renderFullDescription = renderFullDescription;
window.renderShortDescription = renderShortDescription;

console.log('✅ Description Section module loaded');
