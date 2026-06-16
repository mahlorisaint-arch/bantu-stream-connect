// js/content-detail/comments-section.js
// ============================================
// COMMENTS SECTION MODULE - COMPLETE BRAIN
// Contains UI rendering for comments AND its specific database logic:
// - loadComments (DB fetch from 'comments' table)
// - submitComment (DB insert into 'comments' table)
// - renderComments, createCommentElement
// ============================================
console.log('🎬 Comments Section Module Loading...');

/**
 * Load comments from database for a specific content
 * @param {string|number} contentId - The content ID to load comments for
 */
async function loadComments(contentId) {
    if (!contentId) {
        console.warn('⚠️ Cannot load comments: missing contentId');
        return;
    }
    
    try {
        console.log('💬 Loading comments for content:', contentId);
        
        const { data: comments, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .eq('content_id', parseInt(contentId))
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        console.log(`✅ Loaded ${comments?.length || 0} comments`);
        renderComments(comments || []);
        
        // Update comment count in UI and content object
        const countEl = document.getElementById('commentsCount');
        if (countEl) {
            countEl.textContent = `(${comments?.length || 0})`;
        }
        
        if (window.currentContent) {
            window.currentContent.comments_count = comments?.length || 0;
            
            // Optionally update the content table comments_count (non-blocking)
            window.supabaseClient
                .from('Content')
                .update({ comments_count: comments?.length || 0 })
                .eq('id', window.currentContent.id)
                .then(({ error }) => {
                    if (error) console.warn('Failed to update comments_count:', error);
                });
        }
        
        return comments;
    } catch (error) {
        console.error('❌ Comments load failed:', error);
        window.showToast('Failed to load comments', 'error');
        renderComments([]);
        return [];
    }
}

/**
 * Render comments array into the comments list container
 * @param {Array} comments - Array of comment objects
 */
function renderComments(comments) {
    const container = document.getElementById('commentsList');
    const noComments = document.getElementById('noComments');
    const countEl = document.getElementById('commentsCount');
    const loadingEl = document.getElementById('commentsLoading');
    
    if (!container) return;
    
    // Hide loading
    if (loadingEl) loadingEl.style.display = 'none';
    
    container.innerHTML = '';
    
    if (!comments || comments.length === 0) {
        if (noComments) noComments.style.display = 'flex';
        if (countEl) countEl.textContent = '(0)';
        return;
    }
    
    if (noComments) noComments.style.display = 'none';
    if (countEl) countEl.textContent = `(${comments.length})`;
    
    const fragment = document.createDocumentFragment();
    
    comments.forEach(comment => {
        const commentEl = createCommentElement(comment);
        fragment.appendChild(commentEl);
    });
    
    container.appendChild(fragment);
    console.log(`✅ Rendered ${comments.length} comments`);
}

/**
 * Create a single comment DOM element
 * @param {Object} comment - Comment object from database
 * @returns {HTMLElement} - The comment DOM element
 */
function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    
    let authorName = comment.author_name || comment.user_profiles?.full_name || comment.user_profiles?.username || 'User';
    let avatarUrl = comment.author_avatar || comment.user_profiles?.avatar_url || null;
    const time = window.formatCommentTime(comment.created_at);
    const commentText = comment.comment_text || '';
    const initial = authorName.charAt(0).toUpperCase();
    
    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-avatar-sm">
                ${avatarUrl && avatarUrl !== 'null' ?
                    `<img src="${window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl}" 
                          alt="${window.escapeHtml(authorName)}" 
                          style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(29, 78, 216, 0.2);"
                          onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg, #1D4ED8, #F59E0B);color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;\\'>${initial}</div>';">` :
                    `<div style="
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #1D4ED8, #F59E0B);
                        color: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 14px;
                        border: 2px solid rgba(29, 78, 216, 0.2);
                    ">
                        ${initial}
                    </div>`
                }
            </div>
            <div class="comment-user-info">
                <div class="comment-user-name">
                    <strong>${window.escapeHtml(authorName)}</strong>
                </div>
                <div class="comment-time">
                    <i class="fas fa-clock"></i> ${time}
                </div>
            </div>
        </div>
        <div class="comment-content">
            ${window.escapeHtml(commentText)}
        </div>
        <div class="comment-footer">
            <button class="comment-action like-btn" data-comment-id="${comment.id}">
                <i class="far fa-heart"></i> <span>Like</span>
            </button>
            <button class="comment-action reply-btn" data-comment-id="${comment.id}">
                <i class="far fa-comment"></i> <span>Reply</span>
            </button>
        </div>
    `;
    
    return div;
}

/**
 * Submit a new comment to the database
 * @param {string} text - Comment text
 * @returns {Promise<Object|null>} - The created comment or null on error
 */
async function submitComment(text) {
    if (!text || !text.trim()) {
        window.showToast('Please enter a comment', 'warning');
        return null;
    }
    
    if (!window.AuthHelper?.isAuthenticated?.()) {
        window.showToast('You need to sign in to comment', 'warning');
        return null;
    }
    
    const contentIdForComment = window.currentContent?.id || 
        (window.currentPlaylistItems && window.currentPlaylistItems.length > 0 && window.currentPlaylistItems[0]?.id);
    
    if (!contentIdForComment) {
        window.showToast('No content selected', 'error');
        return null;
    }
    
    const sendBtn = document.getElementById('sendCommentBtn');
    const originalHTML = sendBtn?.innerHTML;
    if (sendBtn) {
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        sendBtn.disabled = true;
    }
    
    try {
        const userProfile = window.AuthHelper.getUserProfile();
        const displayName = window.AuthHelper.getDisplayName();
        const avatarUrl = window.AuthHelper.getAvatarUrl();
        
        if (!userProfile?.id) {
            throw new Error('User profile not found');
        }
        
        const { data: newComment, error: insertError } = await window.supabaseClient
            .from('comments')
            .insert({
                content_id: parseInt(contentIdForComment),
                user_id: userProfile.id,
                author_name: displayName,
                comment_text: text.trim(),
                author_avatar: avatarUrl || null,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (insertError) {
            console.error('Comment insert error:', insertError);
            throw insertError;
        }
        
        console.log('✅ Comment inserted:', newComment);
        
        // Reload comments to show the new one
        await loadComments(contentIdForComment);
        
        // Refresh counts to update comment count
        if (typeof window.refreshCountsFromSource === 'function') {
            await window.refreshCountsFromSource();
        }
        
        // Clear input
        const commentInput = document.getElementById('commentInput');
        if (commentInput) commentInput.value = '';
        
        // Update character counter
        updateCharCounter();
        
        window.showToast('Comment added!', 'success');
        
        // Track event if analytics available
        if (window.track?.contentComment) {
            window.track.contentComment(contentIdForComment);
        }
        
        return newComment;
        
    } catch (error) {
        console.error('❌ Comment submission failed:', error);
        window.showToast(error.message || 'Failed to add comment', 'error');
        return null;
        
    } finally {
        if (sendBtn) {
            sendBtn.innerHTML = originalHTML;
            sendBtn.disabled = false;
        }
    }
}

/**
 * Update character counter
 */
function updateCharCounter() {
    const input = document.getElementById('commentInput');
    const counter = document.getElementById('charCounter');
    if (!input || !counter) return;
    
    const maxLength = 500;
    const currentLength = input.value.length;
    const remaining = maxLength - currentLength;
    
    counter.textContent = `${currentLength}/${maxLength}`;
    
    // Update color based on remaining characters
    counter.classList.remove('warning', 'limit');
    if (remaining < 20) {
        counter.classList.add('warning');
    }
    if (remaining < 0) {
        counter.classList.add('limit');
    }
}

/**
 * Update comment input state based on authentication status
 * Enables/disables comment input and updates avatar
 */
async function updateCommentInputState() {
    const commentInput = document.getElementById('commentInput');
    const sendCommentBtn = document.getElementById('sendCommentBtn');
    const commentAvatar = document.getElementById('userCommentAvatar');
    const commentAuthMessage = document.getElementById('commentAuthMessage');
    const charCounter = document.getElementById('charCounter');
    
    if (!commentInput) return;
    
    let isAuthenticated = false;
    let userProfile = null;
    
    if (window.AuthHelper?.isAuthenticated?.()) {
        isAuthenticated = true;
        userProfile = window.AuthHelper.getUserProfile?.();
    } else if (window.currentUser?.id) {
        isAuthenticated = true;
        userProfile = window.currentUser;
    } else {
        try {
            const { data } = await window.supabaseClient?.auth?.getSession?.();
            isAuthenticated = !!data?.session;
            if (isAuthenticated && window.AuthHelper?.getUserProfile) {
                userProfile = window.AuthHelper.getUserProfile();
            }
        } catch (e) {
            console.warn('Auth check fallback:', e);
        }
    }
    
    if (isAuthenticated && userProfile) {
        commentInput.disabled = false;
        commentInput.placeholder = 'Add a comment...';
        if (sendCommentBtn) sendCommentBtn.disabled = false;
        if (commentAuthMessage) commentAuthMessage.style.display = 'none';
        if (charCounter) charCounter.style.display = 'block';
        
        const displayName = userProfile?.full_name || userProfile?.username || userProfile?.email?.split('@')[0] || 'User';
        const avatarUrl = userProfile?.avatar_url || window.AuthHelper?.getAvatarUrl?.();
        
        if (commentAvatar) {
            if (avatarUrl && avatarUrl !== 'null') {
                const fixedUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
                commentAvatar.innerHTML = `<img src="${fixedUrl}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            } else {
                const initial = displayName.charAt(0).toUpperCase();
                commentAvatar.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1.2rem;">${initial}</div>`;
            }
        }
        
        // Update character counter on input
        commentInput.addEventListener('input', updateCharCounter);
        
        console.log('✅ Comment input enabled for user:', displayName);
        
    } else {
        commentInput.disabled = true;
        commentInput.placeholder = 'Sign in to comment';
        if (sendCommentBtn) sendCommentBtn.disabled = true;
        if (commentAuthMessage) commentAuthMessage.style.display = 'block';
        if (charCounter) charCounter.style.display = 'none';
        if (commentAvatar) commentAvatar.innerHTML = '<i class="fas fa-user"></i>';
        
        console.log('🔒 Comment input disabled (not signed in)');
    }
    
    // ============================================
    // CRITICAL FIX: Ensure description section stays intact
    // This prevents comments from interfering with description
    // ============================================
    // Small delay to let auth changes settle, then ensure description works
    setTimeout(function() {
        if (typeof window.refreshDescription === 'function') {
            // Don't call it here - just verify it exists
            console.log('✅ Description section function is available');
        }
        // Re-initialize description section to ensure buttons show
        if (typeof window.setupDescriptionExpandCollapse === 'function') {
            console.log('🔄 Re-initializing description section after auth change...');
            window.setupDescriptionExpandCollapse();
        }
    }, 300);
}

/**
 * Setup comment event listeners (submit button + Enter key)
 * This is the "brain" of the comment module - attaches its own listeners
 */
function setupCommentEventListeners() {
    const sendBtn = document.getElementById('sendCommentBtn');
    const commentInput = document.getElementById('commentInput');
    const refreshBtn = document.getElementById('refreshCommentsBtn');
    const sortSelect = document.getElementById('commentSortSelect');
    
    if (!sendBtn || !commentInput) {
        setTimeout(setupCommentEventListeners, 500);
        return;
    }
    
    // Submit button handler
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    
    newSendBtn.addEventListener('click', async function() {
        const text = commentInput.value.trim();
        if (!text) {
            window.showToast('Please enter a comment', 'warning');
            return;
        }
        await submitComment(text);
    });
    
    // Enter key handler
    commentInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey && !commentInput.disabled) {
            e.preventDefault();
            newSendBtn.click();
        }
    });
    
    // Refresh button handler
    if (refreshBtn) {
        const newRefreshBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
        
        newRefreshBtn.addEventListener('click', async function() {
            const contentIdForComments = window.currentContent?.id || 
                (window.currentPlaylistItems && window.currentPlaylistItems.length > 0 && window.currentPlaylistItems[0]?.id);
            
            if (contentIdForComments) {
                window.showToast('Refreshing comments...', 'info');
                await loadComments(contentIdForComments);
                window.showToast('Comments refreshed!', 'success');
            }
        });
    }
    
    // Sort select handler
    if (sortSelect) {
        const newSortSelect = sortSelect.cloneNode(true);
        sortSelect.parentNode.replaceChild(newSortSelect, sortSelect);
        
        newSortSelect.addEventListener('change', function() {
            const contentIdForComments = window.currentContent?.id || 
                (window.currentPlaylistItems && window.currentPlaylistItems.length > 0 && window.currentPlaylistItems[0]?.id);
            
            if (contentIdForComments) {
                const sortValue = this.value;
                console.log('🔄 Sorting comments by:', sortValue);
                loadCommentsWithSort(contentIdForComments, sortValue);
            }
        });
    }
    
    console.log('✅ Comment event listeners attached');
}

/**
 * Load comments with sorting
 */
async function loadCommentsWithSort(contentId, sortBy) {
    if (!contentId) return;
    
    try {
        let orderColumn = 'created_at';
        let ascending = false;
        
        switch(sortBy) {
            case 'newest':
                orderColumn = 'created_at';
                ascending = false;
                break;
            case 'oldest':
                orderColumn = 'created_at';
                ascending = true;
                break;
            case 'popular':
                orderColumn = 'likes_count';
                ascending = false;
                break;
            default:
                orderColumn = 'created_at';
                ascending = false;
        }
        
        const { data: comments, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .eq('content_id', parseInt(contentId))
            .order(orderColumn, { ascending: ascending });
        
        if (error) throw error;
        
        renderComments(comments || []);
        console.log(`✅ Loaded ${comments?.length || 0} comments sorted by ${sortBy}`);
    } catch (error) {
        console.error('❌ Failed to load sorted comments:', error);
        window.showToast('Failed to load comments', 'error');
    }
}

/**
 * Refresh comments for current content (convenience wrapper)
 */
async function refreshComments() {
    const contentId = window.currentContent?.id;
    if (contentId) {
        await loadComments(contentId);
    }
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.loadComments = loadComments;
window.renderComments = renderComments;
window.createCommentElement = createCommentElement;
window.submitComment = submitComment;
window.updateCommentInputState = updateCommentInputState;
window.setupCommentEventListeners = setupCommentEventListeners;
window.refreshComments = refreshComments;
window.updateCharCounter = updateCharCounter;
window.loadCommentsWithSort = loadCommentsWithSort;

console.log('✅ Comments Section Module loaded (with full brain)');
