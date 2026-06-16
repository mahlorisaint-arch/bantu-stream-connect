// js/content-detail/comments-section.js
// ============================================
// COMMENTS SECTION MODULE - COMPLETE WITH PERSISTENT LIKES
// Like, Reply, Edit, Delete - Full CRUD with like persistence
// ============================================
console.log('🎬 Comments Section Module Loading...');

// Cache for user's liked comments
let userLikedComments = new Set();
let currentUserId = null;

/**
 * Get current user ID
 */
function getCurrentUserId() {
    if (currentUserId) return currentUserId;
    
    const userProfile = window.AuthHelper?.getUserProfile?.();
    if (userProfile?.id) {
        currentUserId = userProfile.id;
        return currentUserId;
    }
    
    if (window.currentUser?.id) {
        currentUserId = window.currentUser.id;
        return currentUserId;
    }
    
    return null;
}

/**
 * Load user's liked comments for the current content
 */
async function loadUserLikes(contentId) {
    const userId = getCurrentUserId();
    if (!userId || !contentId) {
        userLikedComments = new Set();
        return;
    }
    
    try {
        const { data: likes, error } = await window.supabaseClient
            .from('comment_likes')
            .select('comment_id')
            .eq('user_id', userId)
            .in('comment_id', function() {
                // This will be handled by the outer query
            });
        
        // Instead, get all likes for this content's comments
        // First get all comment IDs for this content
        const { data: comments, error: commentsError } = await window.supabaseClient
            .from('comments')
            .select('id')
            .eq('content_id', parseInt(contentId));
        
        if (commentsError) throw commentsError;
        
        const commentIds = comments.map(c => c.id);
        if (commentIds.length === 0) {
            userLikedComments = new Set();
            return;
        }
        
        const { data: likes, error: likesError } = await window.supabaseClient
            .from('comment_likes')
            .select('comment_id')
            .eq('user_id', userId)
            .in('comment_id', commentIds);
        
        if (likesError) throw likesError;
        
        userLikedComments = new Set(likes.map(l => l.comment_id));
        console.log(`✅ Loaded ${userLikedComments.size} liked comments for user`);
    } catch (error) {
        console.error('❌ Failed to load user likes:', error);
        userLikedComments = new Set();
    }
}

/**
 * Load comments from database for a specific content
 */
async function loadComments(contentId) {
    if (!contentId) {
        console.warn('⚠️ Cannot load comments: missing contentId');
        return;
    }
    
    try {
        console.log('💬 Loading comments for content:', contentId);
        
        // Load user's liked comments first
        await loadUserLikes(contentId);
        
        const { data: comments, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .eq('content_id', parseInt(contentId))
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        console.log(`✅ Loaded ${comments?.length || 0} comments`);
        renderComments(comments || []);
        
        const countEl = document.getElementById('commentsCount');
        if (countEl) {
            countEl.textContent = `(${comments?.length || 0})`;
        }
        
        if (window.currentContent) {
            window.currentContent.comments_count = comments?.length || 0;
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
 */
function renderComments(comments) {
    const container = document.getElementById('commentsList');
    const noComments = document.getElementById('noComments');
    const countEl = document.getElementById('commentsCount');
    const loadingEl = document.getElementById('commentsLoading');
    
    if (!container) return;
    
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
 * Create a single comment DOM element with all actions
 */
function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.dataset.commentId = comment.id;
    
    let authorName = comment.author_name || comment.user_profiles?.full_name || comment.user_profiles?.username || 'User';
    let avatarUrl = comment.author_avatar || comment.user_profiles?.avatar_url || null;
    const time = window.formatCommentTime(comment.created_at);
    const commentText = comment.comment_text || '';
    const initial = authorName.charAt(0).toUpperCase();
    
    // Check if current user is the author
    const userId = getCurrentUserId();
    const isAuthor = userId && comment.user_id === userId;
    
    // Check if this comment is liked by the current user
    const isLiked = userLikedComments.has(comment.id);
    
    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-avatar-sm">
                ${avatarUrl && avatarUrl !== 'null' ?
                    `<img src="${window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl}" 
                          alt="${window.escapeHtml(authorName)}" 
                          style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(29, 78, 216, 0.2);"
                          onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg, #1D4ED8, #F59E0B);color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;\\'>${initial}</div>';">` :
                    `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg, #1D4ED8, #F59E0B);color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid rgba(29,78,216,0.2);">${initial}</div>`
                }
            </div>
            <div class="comment-user-info">
                <div class="comment-user-name">
                    <strong>${window.escapeHtml(authorName)}</strong>
                    ${isAuthor ? '<span class="author-badge">Author</span>' : ''}
                </div>
                <div class="comment-time">
                    <i class="fas fa-clock"></i> ${time}
                </div>
            </div>
        </div>
        <div class="comment-content" id="commentContent-${comment.id}">
            ${window.escapeHtml(commentText)}
        </div>
        <div class="comment-footer">
            <button class="comment-action like-btn ${isLiked ? 'liked' : ''}" data-comment-id="${comment.id}">
                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> <span>${isLiked ? 'Liked' : 'Like'}</span>
            </button>
            <button class="comment-action reply-btn" data-comment-id="${comment.id}">
                <i class="far fa-comment"></i> <span>Reply</span>
            </button>
            ${isAuthor ? `
                <button class="comment-action edit-btn" data-comment-id="${comment.id}">
                    <i class="fas fa-pen"></i> <span>Edit</span>
                </button>
                <button class="comment-action delete-btn" data-comment-id="${comment.id}">
                    <i class="fas fa-trash"></i> <span>Delete</span>
                </button>
            ` : ''}
        </div>
        <div class="replies-container" id="repliesContainer-${comment.id}" style="display: none;"></div>
    `;
    
    return div;
}

/**
 * Submit a new comment to the database
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
        
        if (insertError) throw insertError;
        
        console.log('✅ Comment inserted:', newComment);
        await loadComments(contentIdForComment);
        
        const commentInput = document.getElementById('commentInput');
        if (commentInput) commentInput.value = '';
        updateCharCounter();
        
        window.showToast('Comment added!', 'success');
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
 * Submit a reply to a comment
 */
async function submitReply(commentId, text) {
    if (!text || !text.trim()) {
        window.showToast('Please enter a reply', 'warning');
        return null;
    }
    
    if (!window.AuthHelper?.isAuthenticated?.()) {
        window.showToast('You need to sign in to reply', 'warning');
        return null;
    }
    
    try {
        const userProfile = window.AuthHelper.getUserProfile();
        const displayName = window.AuthHelper.getDisplayName();
        const avatarUrl = window.AuthHelper.getAvatarUrl();
        
        if (!userProfile?.id) {
            throw new Error('User profile not found');
        }
        
        const { data: newReply, error: insertError } = await window.supabaseClient
            .from('comment_replies')
            .insert({
                comment_id: commentId,
                user_id: userProfile.id,
                author_name: displayName,
                reply_text: text.trim(),
                author_avatar: avatarUrl || null,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (insertError) throw insertError;
        
        console.log('✅ Reply inserted:', newReply);
        await loadReplies(commentId);
        window.showToast('Reply added!', 'success');
        return newReply;
        
    } catch (error) {
        console.error('❌ Reply submission failed:', error);
        window.showToast(error.message || 'Failed to add reply', 'error');
        return null;
    }
}

/**
 * Load replies for a comment
 */
async function loadReplies(commentId) {
    try {
        const { data: replies, error } = await window.supabaseClient
            .from('comment_replies')
            .select('*')
            .eq('comment_id', commentId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        renderReplies(commentId, replies || []);
        return replies;
    } catch (error) {
        console.error('❌ Failed to load replies:', error);
        return [];
    }
}

/**
 * Render replies for a comment
 */
function renderReplies(commentId, replies) {
    const container = document.getElementById(`repliesContainer-${commentId}`);
    if (!container) return;
    
    if (!replies || replies.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    container.innerHTML = '<div class="replies-section"></div>';
    const repliesSection = container.querySelector('.replies-section');
    
    replies.forEach(reply => {
        const replyEl = createReplyElement(reply);
        repliesSection.appendChild(replyEl);
    });
}

/**
 * Create a single reply element
 */
function createReplyElement(reply) {
    const div = document.createElement('div');
    div.className = 'reply-item';
    div.dataset.replyId = reply.id;
    
    let authorName = reply.author_name || reply.user_profiles?.full_name || reply.user_profiles?.username || 'User';
    let avatarUrl = reply.author_avatar || reply.user_profiles?.avatar_url || null;
    const time = window.formatCommentTime(reply.created_at);
    const replyText = reply.reply_text || '';
    const initial = authorName.charAt(0).toUpperCase();
    
    const userId = getCurrentUserId();
    const isAuthor = userId && reply.user_id === userId;
    
    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-avatar-sm">
                ${avatarUrl && avatarUrl !== 'null' ?
                    `<img src="${window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl}" 
                          alt="${window.escapeHtml(authorName)}" 
                          style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(29, 78, 216, 0.2);"
                          onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg, #1D4ED8, #F59E0B);color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;\\'>${initial}</div>';">` :
                    `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg, #1D4ED8, #F59E0B);color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid rgba(29,78,216,0.2);">${initial}</div>`
                }
            </div>
            <div class="comment-user-info">
                <div class="comment-user-name">
                    <strong>${window.escapeHtml(authorName)}</strong>
                    ${isAuthor ? '<span class="author-badge">Author</span>' : ''}
                </div>
                <div class="comment-time">
                    <i class="fas fa-clock"></i> ${time}
                </div>
            </div>
        </div>
        <div class="comment-content">
            ${window.escapeHtml(replyText)}
        </div>
        <div class="comment-footer">
            ${isAuthor ? `
                <button class="comment-action edit-reply-btn" data-reply-id="${reply.id}">
                    <i class="fas fa-pen"></i> <span>Edit</span>
                </button>
                <button class="comment-action delete-reply-btn" data-reply-id="${reply.id}">
                    <i class="fas fa-trash"></i> <span>Delete</span>
                </button>
            ` : ''}
        </div>
    `;
    
    return div;
}

/**
 * Toggle reply input for a comment
 */
function toggleReplyInput(commentId) {
    const container = document.getElementById(`repliesContainer-${commentId}`);
    if (!container) return;
    
    // Check if reply input already exists
    let existingInput = container.querySelector('.reply-input-container');
    if (existingInput) {
        existingInput.remove();
        // If no replies, hide container
        const repliesSection = container.querySelector('.replies-section');
        if (!repliesSection || repliesSection.children.length === 0) {
            container.style.display = 'none';
        }
        return;
    }
    
    // Create reply input
    container.style.display = 'block';
    let repliesSection = container.querySelector('.replies-section');
    if (!repliesSection) {
        repliesSection = document.createElement('div');
        repliesSection.className = 'replies-section';
        container.appendChild(repliesSection);
    }
    
    const inputDiv = document.createElement('div');
    inputDiv.className = 'reply-input-container';
    inputDiv.innerHTML = `
        <input type="text" class="reply-input" placeholder="Write a reply..." maxlength="500">
        <button class="reply-submit-btn" data-comment-id="${commentId}">Reply</button>
        <button class="reply-cancel-btn">Cancel</button>
    `;
    
    repliesSection.appendChild(inputDiv);
    const input = inputDiv.querySelector('.reply-input');
    input.focus();
    
    // Submit reply
    inputDiv.querySelector('.reply-submit-btn').addEventListener('click', async function() {
        const text = input.value.trim();
        if (text) {
            await submitReply(commentId, text);
            inputDiv.remove();
        }
    });
    
    // Cancel reply
    inputDiv.querySelector('.reply-cancel-btn').addEventListener('click', function() {
        inputDiv.remove();
        const repliesSectionCheck = container.querySelector('.replies-section');
        if (!repliesSectionCheck || repliesSectionCheck.children.length === 0) {
            container.style.display = 'none';
        }
    });
    
    // Enter key
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            inputDiv.querySelector('.reply-submit-btn').click();
        }
    });
}

/**
 * Like a comment with persistence
 */
async function likeComment(commentId) {
    if (!window.AuthHelper?.isAuthenticated?.()) {
        window.showToast('Sign in to like comments', 'warning');
        return;
    }
    
    const userProfile = window.AuthHelper.getUserProfile();
    if (!userProfile?.id) {
        window.showToast('User profile not found', 'error');
        return;
    }
    
    const userId = userProfile.id;
    const likeBtn = document.querySelector(`.like-btn[data-comment-id="${commentId}"]`);
    const isCurrentlyLiked = likeBtn?.classList.contains('liked') || false;
    
    try {
        if (isCurrentlyLiked) {
            // Unlike
            const { error: deleteError } = await window.supabaseClient
                .from('comment_likes')
                .delete()
                .eq('comment_id', commentId)
                .eq('user_id', userId);
            
            if (deleteError) throw deleteError;
            
            // Update cache
            userLikedComments.delete(commentId);
            
            // Update UI
            if (likeBtn) {
                likeBtn.classList.remove('liked');
                likeBtn.innerHTML = '<i class="far fa-heart"></i> <span>Like</span>';
            }
            window.showToast('Unliked comment', 'info');
        } else {
            // Like
            const { error: insertError } = await window.supabaseClient
                .from('comment_likes')
                .insert({
                    comment_id: commentId,
                    user_id: userId
                });
            
            if (insertError) throw insertError;
            
            // Update cache
            userLikedComments.add(commentId);
            
            // Update UI
            if (likeBtn) {
                likeBtn.classList.add('liked');
                likeBtn.innerHTML = '<i class="fas fa-heart"></i> <span>Liked</span>';
            }
            window.showToast('Liked comment!', 'success');
        }
    } catch (error) {
        console.error('❌ Like toggle failed:', error);
        window.showToast('Failed to update like', 'error');
        // Revert UI on error
        if (likeBtn) {
            if (isCurrentlyLiked) {
                likeBtn.classList.add('liked');
                likeBtn.innerHTML = '<i class="fas fa-heart"></i> <span>Liked</span>';
            } else {
                likeBtn.classList.remove('liked');
                likeBtn.innerHTML = '<i class="far fa-heart"></i> <span>Like</span>';
            }
        }
    }
}

/**
 * Edit a comment
 */
function editComment(commentId) {
    const contentEl = document.getElementById(`commentContent-${commentId}`);
    if (!contentEl) return;
    
    const currentText = contentEl.textContent.trim();
    
    // Check if already editing
    if (contentEl.querySelector('textarea')) {
        return;
    }
    
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = currentText;
    textarea.maxLength = 500;
    textarea.style.width = '100%';
    textarea.style.padding = '8px';
    textarea.style.borderRadius = '8px';
    textarea.style.background = 'rgba(255,255,255,0.06)';
    textarea.style.border = '1px solid var(--card-border)';
    textarea.style.color = 'var(--soft-white)';
    textarea.style.fontFamily = 'inherit';
    textarea.style.fontSize = '13px';
    textarea.style.resize = 'vertical';
    textarea.style.minHeight = '60px';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'edit-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.style.marginTop = '8px';
    saveBtn.style.marginRight = '8px';
    saveBtn.style.padding = '6px 16px';
    saveBtn.style.borderRadius = '20px';
    saveBtn.style.border = 'none';
    saveBtn.style.background = 'linear-gradient(135deg, #1D4ED8, #F59E0B)';
    saveBtn.style.color = 'white';
    saveBtn.style.fontWeight = '600';
    saveBtn.style.cursor = 'pointer';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'edit-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.marginTop = '8px';
    cancelBtn.style.padding = '6px 16px';
    cancelBtn.style.borderRadius = '20px';
    cancelBtn.style.border = '1px solid var(--card-border)';
    cancelBtn.style.background = 'rgba(255,255,255,0.08)';
    cancelBtn.style.color = 'var(--soft-white)';
    cancelBtn.style.cursor = 'pointer';
    
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '8px';
    btnContainer.appendChild(saveBtn);
    btnContainer.appendChild(cancelBtn);
    
    contentEl.innerHTML = '';
    contentEl.appendChild(textarea);
    contentEl.appendChild(btnContainer);
    
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    
    // Save handler
    saveBtn.addEventListener('click', async function() {
        const newText = textarea.value.trim();
        if (!newText) {
            window.showToast('Comment cannot be empty', 'warning');
            return;
        }
        
        try {
            const { error } = await window.supabaseClient
                .from('comments')
                .update({ comment_text: newText })
                .eq('id', commentId);
            
            if (error) throw error;
            
            contentEl.textContent = newText;
            window.showToast('Comment updated!', 'success');
            
            const contentId = window.currentContent?.id;
            if (contentId) await loadComments(contentId);
        } catch (error) {
            console.error('❌ Edit failed:', error);
            window.showToast('Failed to update comment', 'error');
        }
    });
    
    // Cancel handler
    cancelBtn.addEventListener('click', function() {
        contentEl.textContent = currentText;
    });
}

/**
 * Delete a comment
 */
async function deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('comments')
            .delete()
            .eq('id', commentId);
        
        if (error) throw error;
        
        window.showToast('Comment deleted', 'info');
        
        const contentId = window.currentContent?.id;
        if (contentId) await loadComments(contentId);
    } catch (error) {
        console.error('❌ Delete failed:', error);
        window.showToast('Failed to delete comment', 'error');
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
    
    counter.classList.remove('warning', 'limit');
    if (remaining < 20) counter.classList.add('warning');
    if (remaining < 0) counter.classList.add('limit');
}

/**
 * Update comment input state based on authentication status
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
    
    // Update current user ID
    if (isAuthenticated && userProfile?.id) {
        currentUserId = userProfile.id;
    } else {
        currentUserId = null;
        userLikedComments = new Set();
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
    
    // Re-initialize description section after auth change
    setTimeout(function() {
        if (typeof window.setupDescriptionExpandCollapse === 'function') {
            window.setupDescriptionExpandCollapse();
        }
    }, 300);
}

/**
 * Setup comment event listeners
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
                loadCommentsWithSort(contentIdForComments, this.value);
            }
        });
    }
    
    // Event delegation for dynamic comment actions
    document.addEventListener('click', async function(e) {
        // Like button
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            e.preventDefault();
            const commentId = likeBtn.dataset.commentId;
            if (commentId) await likeComment(commentId);
            return;
        }
        
        // Reply button
        const replyBtn = e.target.closest('.reply-btn');
        if (replyBtn) {
            e.preventDefault();
            const commentId = replyBtn.dataset.commentId;
            if (commentId) toggleReplyInput(commentId);
            return;
        }
        
        // Edit button
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            e.preventDefault();
            const commentId = editBtn.dataset.commentId;
            if (commentId) editComment(commentId);
            return;
        }
        
        // Delete button
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            const commentId = deleteBtn.dataset.commentId;
            if (commentId) await deleteComment(commentId);
            return;
        }
    });
    
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
            case 'newest': orderColumn = 'created_at'; ascending = false; break;
            case 'oldest': orderColumn = 'created_at'; ascending = true; break;
            case 'popular': orderColumn = 'likes_count'; ascending = false; break;
            default: orderColumn = 'created_at'; ascending = false;
        }
        
        const { data: comments, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .eq('content_id', parseInt(contentId))
            .order(orderColumn, { ascending: ascending });
        
        if (error) throw error;
        renderComments(comments || []);
    } catch (error) {
        console.error('❌ Failed to load sorted comments:', error);
        window.showToast('Failed to load comments', 'error');
    }
}

/**
 * Refresh comments for current content
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
window.submitReply = submitReply;
window.loadReplies = loadReplies;
window.renderReplies = renderReplies;
window.likeComment = likeComment;
window.editComment = editComment;
window.deleteComment = deleteComment;
window.toggleReplyInput = toggleReplyInput;
window.updateCommentInputState = updateCommentInputState;
window.setupCommentEventListeners = setupCommentEventListeners;
window.refreshComments = refreshComments;
window.updateCharCounter = updateCharCounter;
window.loadCommentsWithSort = loadCommentsWithSort;
window.loadUserLikes = loadUserLikes;
window.userLikedComments = userLikedComments;

console.log('✅ Comments Section Module loaded (with persistent likes)');
