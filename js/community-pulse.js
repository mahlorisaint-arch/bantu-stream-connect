/**
 * Community Pulse Feed Logic
 * Connects to Supabase pulse_posts and handles rendering.
 * Uses correct table names: pulse_post_reactions, pulse_post_comments, pulse_post_reposts
 */
const CommunityPulse = {
  feedContainer: document.getElementById('pulse-feed'),
  currentUser: null,
  discoverBtn: null,
  postUpdateBtn: null,
  
  // Store real data from database
  realReactionCounts: {},
  realRepostCounts: {},
  realCommentCounts: {},
  userReactions: {},
  userReposts: {},
  commentsData: {},

  async init() {
    if (!this.feedContainer) return;
    
    // Get current user FIRST - this is critical
    await this.getCurrentUser();
    
    console.log('🔐 Community Pulse Init - Current User:', this.currentUser?.id, this.currentUser?.full_name);
    
    // Setup the enhanced button bar
    this.setupButtonBar();
    
    // Load real feed data
    await this.loadFeed();
  },

  async getCurrentUser() {
    try {
      // Check if supabaseAuth is available
      if (!window.supabaseAuth) {
        console.warn('⚠️ Supabase Auth not initialized');
        this.currentUser = null;
        return;
      }
      
      // Get session first
      const { data: { session }, error: sessionError } = await window.supabaseAuth.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError);
        this.currentUser = null;
        return;
      }
      
      const user = session?.user;
      
      if (user) {
        console.log('✅ User found in session:', user.id, user.email);
        
        // Try to get profile from user_profiles
        try {
          const { data: profile, error: profileError } = await window.supabaseAuth
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profileError) {
            console.warn('⚠️ Profile fetch error:', profileError.message);
          }
          
          if (profile) {
            this.currentUser = {
              id: profile.id,
              full_name: profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              username: profile.username || user.email?.split('@')[0] || 'user',
              email: user.email,
              avatar_url: profile.avatar_url
            };
          } else {
            // Fall back to auth user data
            this.currentUser = {
              id: user.id,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              username: user.email?.split('@')[0] || 'user',
              email: user.email,
              avatar_url: null
            };
          }
        } catch (err) {
          console.warn('⚠️ Profile fetch exception:', err);
          this.currentUser = {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            username: user.email?.split('@')[0] || 'user',
            email: user.email,
            avatar_url: null
          };
        }
        
        console.log('✅ Community Pulse: User loaded successfully:', this.currentUser.full_name);
      } else {
        console.log('ℹ️ Community Pulse: No user logged in');
        this.currentUser = null;
      }
    } catch (err) {
      console.error('❌ Error getting current user:', err);
      this.currentUser = null;
    }
  },

  // Setup button bar - ONLY creates buttons once
  setupButtonBar() {
    // Check if buttons already exist to avoid duplicates
    if (document.querySelector('.pulse-button-container')) {
      console.log('✅ Pulse buttons already exist, skipping creation');
      return;
    }
    
    const sectionHeader = document.querySelector('#community-pulse-section .section-header');
    if (!sectionHeader) return;
    
    // Remove any existing old create-post-btn
    const oldCreateBtn = document.getElementById('create-post-btn');
    if (oldCreateBtn && !oldCreateBtn.classList.contains('pulse-post-btn')) {
      oldCreateBtn.remove();
    }
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'pulse-button-container';
    buttonContainer.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    
    // 1. Create "Post Update" button
    this.postUpdateBtn = document.createElement('button');
    this.postUpdateBtn.id = 'create-post-btn';
    this.postUpdateBtn.className = 'pulse-btn pulse-post-btn';
    this.postUpdateBtn.innerHTML = '<i class="fas fa-pen"></i> Post Update';
    this.postUpdateBtn.style.cssText = `
      background: linear-gradient(135deg, var(--bantu-blue, #1D4ED8), var(--warm-gold, #F59E0B));
      border: none;
      padding: 6px 12px;
      border-radius: 20px;
      color: white;
      font-weight: 500;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    `;
    
    // 2. Create "Discover Creators" button
    this.discoverBtn = document.createElement('button');
    this.discoverBtn.id = 'discover-creators-btn';
    this.discoverBtn.className = 'pulse-btn pulse-discover-btn';
    this.discoverBtn.innerHTML = '<i class="fas fa-user-plus"></i> Discover Creators';
    this.discoverBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid var(--card-border, rgba(255, 255, 255, 0.2));
      padding: 6px 12px;
      border-radius: 20px;
      color: var(--soft-white, #F5F5F5);
      font-weight: 500;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    `;
    
    // Hover effects
    this.postUpdateBtn.onmouseenter = () => {
      this.postUpdateBtn.style.transform = 'translateY(-1px)';
      this.postUpdateBtn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
    };
    this.postUpdateBtn.onmouseleave = () => {
      this.postUpdateBtn.style.transform = 'translateY(0)';
      this.postUpdateBtn.style.boxShadow = 'none';
    };
    
    this.discoverBtn.onmouseenter = () => {
      this.discoverBtn.style.transform = 'translateY(-1px)';
      this.discoverBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    };
    this.discoverBtn.onmouseleave = () => {
      this.discoverBtn.style.transform = 'translateY(0)';
      this.discoverBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    };
    
    // Post Update button - redirect to create-communitypulse page
    this.postUpdateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = 'https://bantustreamconnect.com/create-communitypulse';
    });
    
    // Discover Creators button - redirect to discover-creator page
    this.discoverBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = 'https://bantustreamconnect.com/discover-creator';
    });
    
    buttonContainer.appendChild(this.postUpdateBtn);
    buttonContainer.appendChild(this.discoverBtn);
    
    // Append button container to section header
    sectionHeader.appendChild(buttonContainer);
  },

  async loadFeed() {
    try {
      if (!window.supabaseAuth) {
        console.warn('Supabase not initialized');
        this.showEmptyState();
        return;
      }

      // Fetch real posts from database
      const { data: posts, error } = await window.supabaseAuth
        .from('pulse_posts')
        .select(`
          id, content, post_type, created_at, visibility, is_pinned,
          creator_id, 
          user_profiles!creator_id (id, username, full_name, avatar_url),
          pulse_smart_links (id, link_type, target_content_id, external_url, cta_text),
          pulse_post_media (id, media_url, media_type, order_index)
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (!posts || posts.length === 0) {
        this.showEmptyState();
        return;
      }

      // Load real counts for each post using correct table names
      await this.loadRealCounts(posts);
      
      // Render with real data
      this.renderFeed(posts);
      
    } catch (err) {
      console.error('Failed to load Pulse:', err);
      this.showEmptyState();
    }
  },

  // Load real counts from database using correct table names
  async loadRealCounts(posts) {
    console.log('📊 Loading real counts for', posts.length, 'posts');
    console.log('👤 Current user for counts:', this.currentUser?.id);
    
    for (const post of posts) {
      const postId = post.id;
      
      // Fetch real reaction counts from pulse_post_reactions
      try {
        const { count: reactions, error: reactionError } = await window.supabaseAuth
          .from('pulse_post_reactions')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId)
          .eq('reaction_type', 'fire');
        
        if (!reactionError) {
          this.realReactionCounts[postId] = reactions || 0;
        } else {
          this.realReactionCounts[postId] = 0;
        }
        
        // Check if current user reacted
        if (this.currentUser && this.currentUser.id) {
          const { data: userReaction, error: userReactError } = await window.supabaseAuth
            .from('pulse_post_reactions')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', this.currentUser.id)
            .eq('reaction_type', 'fire')
            .maybeSingle();
          
          this.userReactions[postId] = !userReactError && userReaction !== null;
        } else {
          this.userReactions[postId] = false;
        }
        
      } catch (e) {
        console.warn(`Could not fetch reactions for post ${postId}:`, e);
        this.realReactionCounts[postId] = 0;
        this.userReactions[postId] = false;
      }
      
      // Fetch real repost counts from pulse_post_reposts
      try {
        const { count: reposts, error: repostError } = await window.supabaseAuth
          .from('pulse_post_reposts')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId);
        
        if (!repostError) {
          this.realRepostCounts[postId] = reposts || 0;
        } else {
          this.realRepostCounts[postId] = 0;
        }
        
        // Check if current user reposted
        if (this.currentUser && this.currentUser.id) {
          const { data: userRepost, error: userRepostError } = await window.supabaseAuth
            .from('pulse_post_reposts')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', this.currentUser.id)
            .maybeSingle();
          
          this.userReposts[postId] = !userRepostError && userRepost !== null;
        } else {
          this.userReposts[postId] = false;
        }
        
      } catch (e) {
        console.warn(`Could not fetch reposts for post ${postId}:`, e);
        this.realRepostCounts[postId] = 0;
        this.userReposts[postId] = false;
      }
      
      // Fetch real comment counts from pulse_post_comments
      try {
        const { count: comments, error: commentError } = await window.supabaseAuth
          .from('pulse_post_comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId);
        
        if (!commentError) {
          this.realCommentCounts[postId] = comments || 0;
        } else {
          this.realCommentCounts[postId] = 0;
        }
        
        // Load actual comments data
        const { data: commentsData, error: commentsDataError } = await window.supabaseAuth
          .from('pulse_post_comments')
          .select(`
            id, 
            content, 
            user_id, 
            created_at,
            user_profiles!user_id (
              id,
              full_name, 
              username, 
              avatar_url
            )
          `)
          .eq('post_id', postId)
          .is('parent_comment_id', null)
          .order('created_at', { ascending: false });
        
        if (!commentsDataError && commentsData) {
          this.commentsData[postId] = commentsData;
        } else {
          this.commentsData[postId] = [];
        }
        
      } catch (e) {
        console.warn(`Could not fetch comments for post ${postId}:`, e);
        this.realCommentCounts[postId] = 0;
        this.commentsData[postId] = [];
      }
    }
    
    console.log('✅ Loaded counts:', {
      reactions: this.realReactionCounts,
      reposts: this.realRepostCounts,
      comments: this.realCommentCounts,
      userReactions: this.userReactions,
      userReposts: this.userReposts
    });
  },

  showEmptyState() {
    if (!this.feedContainer) return;
    this.feedContainer.innerHTML = `
      <div class="empty-pulse">
        <i class="fas fa-newspaper" style="font-size: 48px; color: var(--slate-grey);"></i>
        <p style="color: var(--slate-grey); margin-top: 16px;">No updates yet. Connect with creators to see their posts!</p>
        <button class="see-all-btn" id="empty-connect-btn" style="margin-top: 16px;">
          <i class="fas fa-user-plus"></i> Discover Creators
        </button>
      </div>
    `;
    
    const connectBtn = document.getElementById('empty-connect-btn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        window.location.href = 'https://bantustreamconnect.com/discover-creator';
      });
    }
  },

  renderFeed(posts) {
    if (!this.feedContainer) return;
    this.feedContainer.innerHTML = '';
    posts.forEach(post => this.renderPost(post));
  },

  renderPost(post) {
    const creator = post.user_profiles || { username: 'anonymous', full_name: 'Anonymous', avatar_url: null };
    const displayName = creator.full_name || creator.username || 'Creator';
    const username = creator.username || 'creator';
    const avatarUrl = creator.avatar_url;
    const postId = post.id;
    
    const initials = displayName.charAt(0).toUpperCase();
    const avatarHtml = avatarUrl 
      ? `<img src="${this.fixImageUrl(avatarUrl)}" alt="${displayName}" onerror="this.src='';this.parentElement.innerHTML='${initials}';">` 
      : initials;

    // Get REAL counts from loaded data
    const reactionCount = this.realReactionCounts[postId] || 0;
    const repostCount = this.realRepostCounts[postId] || 0;
    const commentCount = this.realCommentCounts[postId] || 0;
    const userReacted = this.userReactions[postId] || false;
    const userReposted = this.userReposts[postId] || false;

    const card = document.createElement('div');
    card.className = 'pulse-card';
    card.dataset.postId = postId;
    
    card.innerHTML = `
      <div class="pulse-header">
        <div class="pulse-avatar">${avatarHtml}</div>
        <div class="pulse-creator-info">
          <h4>${this.escapeHtml(displayName)}</h4>
          <span>@${this.escapeHtml(username)} • ${this.formatTimeAgo(post.created_at)}</span>
        </div>
      </div>
      <div class="pulse-content">${this.escapeHtml(post.content)}</div>
      ${this.renderMedia(post.pulse_post_media)}
      ${this.renderSmartLink(post.pulse_smart_links?.[0], postId)}
      <div class="pulse-actions">
        <button class="action-btn fire-btn ${userReacted ? 'active' : ''}" data-id="${postId}">
          <i class="fas fa-fire"></i> <span class="reaction-count">${reactionCount}</span>
        </button>
        <button class="action-btn comment-btn" data-id="${postId}">
          <i class="fas fa-comment"></i> <span class="comment-count">${commentCount}</span>
        </button>
        <button class="action-btn repost-btn ${userReposted ? 'active' : ''}" data-id="${postId}">
          <i class="fas fa-retweet"></i> <span class="repost-count">${repostCount}</span>
        </button>
        <button class="action-btn share-btn" data-id="${postId}">
          <i class="fas fa-share"></i>
        </button>
      </div>
    `;

    // Attach Smart Link click handler
    const smartLinkDiv = card.querySelector('.smart-link-card');
    const smartLinkData = post.pulse_smart_links?.[0];
    
    if (smartLinkDiv && smartLinkData) {
      smartLinkDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleSmartLinkClick(smartLinkData, displayName);
      });
    }
    
    // Attach action button handlers with proper binding
    const fireBtn = card.querySelector('.fire-btn');
    const commentBtn = card.querySelector('.comment-btn');
    const repostBtn = card.querySelector('.repost-btn');
    const shareBtn = card.querySelector('.share-btn');
    
    if (fireBtn) {
      fireBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.handleReaction(postId);
      });
    }
    
    if (commentBtn) {
      commentBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.handleComment(postId);
      });
    }
    
    if (repostBtn) {
      repostBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.handleRepost(postId);
      });
    }
    
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleShare(postId);
      });
    }

    this.feedContainer.appendChild(card);
  },

  // Handle reaction using pulse_post_reactions table
  async handleReaction(postId) {
    console.log('🔥 Reaction clicked. Current user:', this.currentUser?.id);
    
    // Double-check authentication
    if (!this.currentUser || !this.currentUser.id) {
      console.warn('No user logged in, showing sign in prompt');
      this.showToast('Please sign in to react', 'warning');
      // Redirect to login
      setTimeout(() => {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      }, 1500);
      return;
    }
    
    const btn = document.querySelector(`.fire-btn[data-id="${postId}"]`);
    if (!btn) return;
    
    const wasActive = btn.classList.contains('active');
    const countSpan = btn.querySelector('.reaction-count');
    let currentCount = parseInt(countSpan.textContent) || 0;
    
    try {
      if (wasActive) {
        // Remove reaction
        console.log('Removing reaction for post:', postId, 'user:', this.currentUser.id);
        const { error } = await window.supabaseAuth
          .from('pulse_post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', this.currentUser.id)
          .eq('reaction_type', 'fire');
        
        if (!error) {
          btn.classList.remove('active');
          currentCount--;
          countSpan.textContent = currentCount;
          this.realReactionCounts[postId] = currentCount;
          this.userReactions[postId] = false;
          this.showToast('Reaction removed', 'info');
          console.log('✅ Reaction removed successfully');
        } else {
          console.error('Delete reaction error:', error);
          this.showToast('Failed to remove reaction', 'error');
        }
      } else {
        // Add reaction
        console.log('Adding reaction for post:', postId, 'user:', this.currentUser.id);
        const { error } = await window.supabaseAuth
          .from('pulse_post_reactions')
          .insert({
            post_id: postId,
            user_id: this.currentUser.id,
            reaction_type: 'fire'
          });
        
        if (!error) {
          btn.classList.add('active');
          currentCount++;
          countSpan.textContent = currentCount;
          this.realReactionCounts[postId] = currentCount;
          this.userReactions[postId] = true;
          this.showToast('🔥 You reacted with fire!', 'success');
          console.log('✅ Reaction added successfully');
        } else {
          console.error('Insert reaction error:', error);
          this.showToast('Failed to add reaction', 'error');
        }
      }
    } catch (err) {
      console.error('Reaction error:', err);
      this.showToast('Failed to update reaction', 'error');
    }
  },

  // Handle comment using pulse_post_comments table
  async handleComment(postId) {
    console.log('💬 Comment clicked. Current user:', this.currentUser?.id);
    
    // Double-check authentication
    if (!this.currentUser || !this.currentUser.id) {
      console.warn('No user logged in, showing sign in prompt');
      this.showToast('Please sign in to comment', 'warning');
      setTimeout(() => {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      }, 1500);
      return;
    }
    
    // Get existing comments from database
    let comments = this.commentsData[postId] || [];
    
    // Fetch fresh comments
    try {
      const { data: freshComments, error } = await window.supabaseAuth
        .from('pulse_post_comments')
        .select(`
          id, 
          content, 
          user_id, 
          created_at,
          user_profiles!user_id (
            id,
            full_name, 
            username, 
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: false });
      
      if (!error && freshComments) {
        comments = freshComments;
        this.commentsData[postId] = comments;
        // Update comment count
        this.realCommentCounts[postId] = comments.length;
        const commentBtn = document.querySelector(`.comment-btn[data-id="${postId}"] .comment-count`);
        if (commentBtn) {
          commentBtn.textContent = comments.length;
        }
      }
    } catch (e) {
      console.warn('Could not fetch fresh comments:', e);
    }
    
    const modalHtml = `
      <div id="comment-modal-${postId}" class="modal-overlay">
        <div class="modal-content" style="max-width: 500px;">
          <div class="modal-header">
            <h3><i class="fas fa-comment"></i> Comments (${comments.length})</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
            <div id="comments-list-${postId}" class="comments-list" style="margin-bottom: 20px;">
              ${comments.length === 0 ? '<p style="color: var(--slate-grey); text-align: center;">No comments yet. Be the first to comment!</p>' : ''}
              ${comments.map(comment => {
                const commentAuthor = comment.user_profiles || {};
                const authorName = commentAuthor.full_name || commentAuthor.username || 'User';
                const authorInitials = authorName.charAt(0).toUpperCase();
                return `
                  <div class="comment-item" style="padding: 12px; border-bottom: 1px solid var(--card-border);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                      <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--bantu-blue), var(--warm-gold)); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
                        ${authorInitials}
                      </div>
                      <div>
                        <strong style="color: var(--soft-white); font-size: 14px;">${this.escapeHtml(authorName)}</strong>
                        <div style="color: var(--slate-grey); font-size: 11px;">${this.formatTimeAgo(comment.created_at)}</div>
                      </div>
                    </div>
                    <p style="color: var(--soft-white); margin: 0; font-size: 14px;">${this.escapeHtml(comment.content)}</p>
                  </div>
                `;
              }).join('')}
            </div>
            <textarea id="comment-input-${postId}" placeholder="Write a comment..." rows="3" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--card-border); border-radius: 12px; padding: 12px; color: var(--soft-white); font-family: inherit; resize: vertical;"></textarea>
          </div>
          <div class="modal-footer">
            <button class="cancel-btn">Cancel</button>
            <button class="submit-btn post-comment-btn">Post Comment</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById(`comment-modal-${postId}`);
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const submitBtn = modal.querySelector('.post-comment-btn');
    const commentInput = document.getElementById(`comment-input-${postId}`);
    
    const closeModal = () => modal.remove();
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    submitBtn.addEventListener('click', async () => {
      const commentText = commentInput.value.trim();
      if (!commentText) {
        this.showToast('Please enter a comment', 'warning');
        return;
      }
      
      if (!this.currentUser || !this.currentUser.id) {
        this.showToast('Please sign in to comment', 'warning');
        closeModal();
        return;
      }
      
      // Save comment to pulse_post_comments table
      try {
        const { data: newComment, error } = await window.supabaseAuth
          .from('pulse_post_comments')
          .insert({
            post_id: postId,
            user_id: this.currentUser.id,
            content: commentText,
            parent_comment_id: null
          })
          .select(`
            id, 
            content, 
            user_id, 
            created_at,
            user_profiles!user_id (
              id,
              full_name, 
              username, 
              avatar_url
            )
          `)
          .single();
        
        if (error) throw error;
        
        // Update local data
        if (!this.commentsData[postId]) {
          this.commentsData[postId] = [];
        }
        this.commentsData[postId].unshift(newComment);
        
        // Update comment count
        const newCount = (this.realCommentCounts[postId] || 0) + 1;
        this.realCommentCounts[postId] = newCount;
        
        // Update UI count
        const commentBtnElement = document.querySelector(`.comment-btn[data-id="${postId}"] .comment-count`);
        if (commentBtnElement) {
          commentBtnElement.textContent = newCount;
        }
        
        this.showToast('Comment posted!', 'success');
        closeModal();
        
      } catch (err) {
        console.error('Comment error:', err);
        this.showToast('Failed to post comment', 'error');
      }
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  },

  // Handle repost using pulse_post_reposts table
  async handleRepost(postId) {
    console.log('🔄 Repost clicked. Current user:', this.currentUser?.id);
    
    // Double-check authentication
    if (!this.currentUser || !this.currentUser.id) {
      console.warn('No user logged in, showing sign in prompt');
      this.showToast('Please sign in to repost', 'warning');
      setTimeout(() => {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      }, 1500);
      return;
    }
    
    const btn = document.querySelector(`.repost-btn[data-id="${postId}"]`);
    if (!btn) return;
    
    const wasActive = btn.classList.contains('active');
    const countSpan = btn.querySelector('.repost-count');
    let currentCount = parseInt(countSpan.textContent) || 0;
    
    try {
      if (wasActive) {
        // Remove repost
        console.log('Removing repost for post:', postId, 'user:', this.currentUser.id);
        const { error } = await window.supabaseAuth
          .from('pulse_post_reposts')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', this.currentUser.id);
        
        if (!error) {
          btn.classList.remove('active');
          currentCount--;
          countSpan.textContent = currentCount;
          this.realRepostCounts[postId] = currentCount;
          this.userReposts[postId] = false;
          this.showToast('Repost removed', 'info');
          console.log('✅ Repost removed successfully');
        } else {
          console.error('Delete repost error:', error);
          this.showToast('Failed to remove repost', 'error');
        }
      } else {
        // Add repost
        console.log('Adding repost for post:', postId, 'user:', this.currentUser.id);
        const { error } = await window.supabaseAuth
          .from('pulse_post_reposts')
          .insert({
            post_id: postId,
            user_id: this.currentUser.id
          });
        
        if (!error) {
          btn.classList.add('active');
          currentCount++;
          countSpan.textContent = currentCount;
          this.realRepostCounts[postId] = currentCount;
          this.userReposts[postId] = true;
          this.showToast('✅ Reposted to your profile!', 'success');
          console.log('✅ Repost added successfully');
        } else {
          console.error('Insert repost error:', error);
          this.showToast('Failed to add repost', 'error');
        }
      }
    } catch (err) {
      console.error('Repost error:', err);
      this.showToast('Failed to update repost', 'error');
    }
  },

  handleShare(postId) {
    const url = `${window.location.origin}?post=${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Link copied to clipboard!', 'success');
    }).catch(() => {
      this.showToast('Share: ' + url, 'info');
    });
  },

  handleSmartLinkClick(link, creatorName) {
    if (!link) return;
    
    const { link_type, target_content_id, external_url, cta_text } = link;
    
    if (link_type === 'music' || link_type === 'podcast') {
      let audioUrl = external_url;
      let trackTitle = cta_text || `${link_type.toUpperCase()} Track`;
      
      if (!audioUrl) {
        audioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
      }
      
      if (window.playSmartLink) {
        window.playSmartLink(audioUrl, trackTitle, creatorName);
        this.showToast(`Now playing: ${trackTitle}`, 'success');
      } else {
        this.showToast('Audio player coming soon!', 'info');
      }
    } else if (link_type === 'video' && target_content_id) {
      window.location.href = `content-detail.html?id=${target_content_id}`;
    } else if (link_type === 'article' && target_content_id) {
      window.location.href = `insights-detail.html?id=${target_content_id}`;
    } else if (external_url) {
      window.open(external_url, '_blank');
    } else {
      this.showToast('Content coming soon!', 'info');
    }
  },

  renderMedia(mediaArray) {
    if (!mediaArray || mediaArray.length === 0) return '';
    
    const media = mediaArray[0];
    if (media.media_type === 'image') {
      return `
        <div class="pulse-media">
          <img src="${this.fixImageUrl(media.media_url)}" loading="lazy" onerror="this.style.display='none'">
        </div>
      `;
    }
    if (media.media_type === 'video') {
      return `
        <div class="pulse-media">
          <video controls preload="metadata">
            <source src="${this.fixImageUrl(media.media_url)}">
          </video>
        </div>
      `;
    }
    return '';
  },

  renderSmartLink(link, postId) {
    if (!link) return '';
    
    const iconMap = {
      music: 'fa-music',
      video: 'fa-video',
      podcast: 'fa-podcast',
      playlist: 'fa-list',
      article: 'fa-newspaper'
    };
    const icon = iconMap[link.link_type] || 'fa-link';
    const ctaText = link.cta_text || `Open ${link.link_type}`;
    
    return `
      <div class="smart-link-card" data-link-id="${link.id}" data-post-id="${postId}">
        <div class="smart-link-icon"><i class="fas ${icon}"></i></div>
        <div class="smart-link-info">
          <h5>${link.link_type.toUpperCase()}</h5>
          <p>${this.escapeHtml(ctaText)}</p>
        </div>
        <div class="smart-link-arrow">
          <i class="fas fa-chevron-right"></i>
        </div>
      </div>
    `;
  },

  fixImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (window.fixMediaUrl) return window.fixMediaUrl(url);
    if (window.fixAvatarUrl) return window.fixAvatarUrl(url);
    return url;
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  },

  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
      <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CommunityPulse.init());
} else {
  CommunityPulse.init();
}
