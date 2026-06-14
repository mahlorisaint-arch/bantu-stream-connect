// js/content-detail/comments-section.js
// Extracted from content-detail.js - Comments Section Management

console.log('💬 Comments Section module loading...');

// ============================================
// LOAD COMMENTS
// ============================================
async function loadComments(contentId) {
    try {
        console.log('💬 Loading comments for content:', contentId);
        
        const { data: comments, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .eq('content_id', parseInt(contentId))
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        console.log(`✅ Loaded ${comments.length} comments`);
        renderComments(comments || []);
        
        const countEl = document.getElementById('commentsCount');
        if (countEl) {
            countEl.textContent = `(${comments.length})`;
        }
        
        // Update comments count in content table
        if (window.currentContent) {
            const { error: updateError } = await window.supabaseClient
                .from('Content')
                .update({ comments_count: comments.length })
                .eq('id', window.currentContent.id);
            
            if (updateError) {
                console.warn('Failed to update comments_count:', updateError);
            }
        }
        
    } catch (error) {
        console.error('❌ Comments load failed:', error);
        if (typeof showToast === 'function') {
            showToast('Failed to load comments', 'error');
        }
        renderComments([]);
    }
}

// ============================================
// RENDER COMMENTS
// ============================================
function renderComments(comments) {
    const container = document.getElementById('commentsList');
    const noComments = document.getElementById('noComments');
    const countEl = document.getElementById('commentsCount');
    
    if (!container) return;
    
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
}

// ============================================
// CREATE COMMENT ELEMENT
// ============================================
function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    
    let authorName = comment.author_name || 'User';
    let avatarUrl = comment.author_avatar || null;
    const time = formatCommentTime(comment.created_at);
    const commentText = comment.comment_text || '';
    const initial = authorName.charAt(0).toUpperCase();
    
    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-avatar-sm">
                ${avatarUrl ?
                    `<img src="${avatarUrl}" alt="${authorName}" 
                          style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(29, 78, 216, 0.2);">` :
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
            <div class="comment-user">
                <strong>${escapeHtml(authorName)}</strong>
                <div class="comment-time">${time}</div>
            </div>
        </div>
        <div class="comment-content">
            ${escapeHtml(commentText)}
        </div>
    `;
    
    return div;
}

// ============================================
// SUBMIT COMMENT
// ============================================
async function submitComment(contentId, commentText) {
    if (!commentText || !commentText.trim()) {
        if (typeof showToast === 'function') {
            showToast('Please enter a comment', 'warning');
        }
        return false;
    }
    
    if (!window.AuthHelper?.isAuthenticated?.()) {
        if (typeof showToast === 'function') {
            showToast('You need to sign in to comment', 'warning');
        }
        return false;
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
                content_id: parseInt(contentId),
                user_id: userProfile.id,
                author_name: displayName,
                comment_text: commentText.trim(),
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
        
        // Reload comments
        await loadComments(contentId);
        
        // Refresh counts
        if (typeof refreshCountsFromSource === 'function') {
            await refreshCountsFromSource();
        }
        
        if (typeof showToast === 'function') {
            showToast('Comment added!', 'success');
        }
        
        if (window.track?.contentComment) {
            window.track.contentComment(contentId);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Comment submission failed:', error);
        if (typeof showToast === 'function') {
            showToast(error.message || 'Failed to add comment', 'error');
        }
        return false;
    }
}

// ============================================
// SETUP COMMENT INPUT STATE (enable/disable based on auth)
// ============================================
async function updateCommentInputState() {
    const commentInput = document.getElementById('commentInput');
    const sendBtn = document.getElementById('sendCommentBtn');
    const commentAvatar = document.getElementById('userCommentAvatar');
    
    if (!commentInput || !sendBtn) return;
    
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
        commentInput.placeholder = 'Write a comment...';
        sendBtn.disabled = false;
        
        const displayName = userProfile?.full_name || userProfile?.username || userProfile?.email?.split('@')[0] || 'User';
        const avatarUrl = userProfile?.avatar_url || window.AuthHelper?.getAvatarUrl?.();
        
        if (commentAvatar) {
            if (avatarUrl && avatarUrl !== 'null') {
                const fixedUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
                commentAvatar.innerHTML = `<img src="${fixedUrl}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            } else {
                const initial = displayName.charAt(0).toUpperCase();
                commentAvatar.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">${initial}</div>`;
            }
        }
    } else {
        commentInput.disabled = true;
        commentInput.placeholder = 'Sign in to add a comment...';
        sendBtn.disabled = true;
        if (commentAvatar) {
            commentAvatar.innerHTML = '<i class="fas fa-user"></i>';
        }
    }
}

// ============================================
// SETUP COMMENT EVENT LISTENERS
// ============================================
function setupCommentEventListeners() {
    const sendBtn = document.getElementById('sendCommentBtn');
    const commentInput = document.getElementById('commentInput');
    
    if (!sendBtn || !commentInput) return;
    
    // Remove existing listeners by cloning
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    
    newSendBtn.addEventListener('click', async function() {
        const text = commentInput.value.trim();
        if (!text) {
            if (typeof showToast === 'function') {
                showToast('Please enter a comment', 'warning');
            }
            return;
        }
        
        if (!window.AuthHelper?.isAuthenticated?.()) {
            if (typeof showToast === 'function') {
                showToast('You need to sign in to comment', 'warning');
            }
            return;
        }
        
        const contentIdForComment = window.currentContent?.id || 
            (window.currentPlaylistItems && window.currentPlaylistItems.length > 0 && window.currentPlaylistItems[0]?.id);
        
        if (!contentIdForComment) return;
        
        const originalHTML = newSendBtn.innerHTML;
        newSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        newSendBtn.disabled = true;
        
        const success = await submitComment(contentIdForComment, text);
        
        if (success) {
            commentInput.value = '';
        }
        
        newSendBtn.innerHTML = originalHTML;
        newSendBtn.disabled = false;
    });
    
    commentInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey && !commentInput.disabled) {
            e.preventDefault();
            newSendBtn.click();
        }
    });
    
    // Refresh comments button
    const refreshBtn = document.getElementById('refreshCommentsBtn');
    if (refreshBtn) {
        const newRefreshBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
        
        newRefreshBtn.addEventListener('click', async function() {
            const contentIdForComments = window.currentContent?.id || 
                (window.currentPlaylistItems && window.currentPlaylistItems.length > 0 && window.currentPlaylistItems[0]?.id);
            
            if (contentIdForComments) {
                if (typeof showToast === 'function') {
                    showToast('Refreshing comments...', 'info');
                }
                await loadComments(contentIdForComments);
                if (typeof showToast === 'function') {
                    showToast('Comments refreshed!', 'success');
                }
            }
        });
    }
}

// ============================================
// FORMAT COMMENT TIME
// ============================================
function formatCommentTime(timestamp) {
    if (!timestamp) return 'Just now';
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return diffMins + ' min ago';
        if (diffHours < 60) return diffHours + ' hour' + (diffHours !== 1 ? 's' : '') + ' ago';
        if (diffDays < 7) return diffDays + ' day' + (diffDays !== 1 ? 's' : '') + ' ago';
        
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return 'Recently';
    }
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
window.loadComments = loadComments;
window.renderComments = renderComments;
window.submitComment = submitComment;
window.updateCommentInputState = updateCommentInputState;
window.setupCommentEventListeners = setupCommentEventListeners;

console.log('✅ Comments Section module loaded');
