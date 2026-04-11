/**
 * Community Pulse Feed Logic
 * Connects to Supabase pulse_posts and handles rendering.
 * INTEGRATED: Smart Links now trigger the global audio player
 */
const CommunityPulse = {
  feedContainer: document.getElementById('pulse-feed'),
  createBtn: document.getElementById('create-post-btn'),
  currentUser: null,
  discoverBtn: null, // For the new discover creators button

  async init() {
    if (!this.feedContainer) return;
    
    // Get current user
    await this.getCurrentUser();
    
    // Setup the enhanced button bar
    this.setupButtonBar();
    
    await this.loadFeed();
  },

  async getCurrentUser() {
    try {
      if (window.supabaseAuth && window.supabaseAuth.getUser) {
        const { data: { user } } = await window.supabaseAuth.getUser();
        if (user) {
          const { data: profile } = await window.supabaseAuth
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          this.currentUser = profile || user;
          console.log('✅ Community Pulse: User loaded', this.currentUser?.full_name);
        } else {
          console.log('ℹ️ Community Pulse: No user logged in');
        }
      }
    } catch (err) {
      console.log('User not logged in:', err);
      this.currentUser = null;
    }
  },

  // ✅ NEW: Setup button bar with Post Update and Discover Creators
  setupButtonBar() {
    const sectionHeader = document.querySelector('#community-pulse-section .section-header');
    if (!sectionHeader) return;
    
    // Clear existing buttons
    const existingButtons = sectionHeader.querySelectorAll('.pulse-btn');
    existingButtons.forEach(btn => btn.remove());
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'pulse-button-container';
    buttonContainer.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    
    // 1. Create "Post Update" button (REDUCED SIZE - quarter of original)
    const postUpdateBtn = document.createElement('button');
    postUpdateBtn.id = 'create-post-btn';
    postUpdateBtn.className = 'pulse-btn pulse-post-btn';
    postUpdateBtn.innerHTML = '<i class="fas fa-pen"></i> Post Update';
    postUpdateBtn.style.cssText = `
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
    
    // 2. Create "Discover Creators" button (REDUCED SIZE - quarter of original)
    const discoverBtn = document.createElement('button');
    discoverBtn.id = 'discover-creators-btn';
    discoverBtn.className = 'pulse-btn pulse-discover-btn';
    discoverBtn.innerHTML = '<i class="fas fa-user-plus"></i> Discover Creators';
    discoverBtn.style.cssText = `
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
    postUpdateBtn.onmouseenter = () => {
      postUpdateBtn.style.transform = 'translateY(-1px)';
      postUpdateBtn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
    };
    postUpdateBtn.onmouseleave = () => {
      postUpdateBtn.style.transform = 'translateY(0)';
      postUpdateBtn.style.boxShadow = 'none';
    };
    
    discoverBtn.onmouseenter = () => {
      discoverBtn.style.transform = 'translateY(-1px)';
      discoverBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    };
    discoverBtn.onmouseleave = () => {
      discoverBtn.style.transform = 'translateY(0)';
      discoverBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    };
    
    // ✅ FIX 1: Post Update button - Redirect to create-communitypulse page
    postUpdateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('📝 Post Update clicked, user:', this.currentUser?.full_name);
      
      // Always redirect to the create-communitypulse page
      // The target page will handle authentication
      window.location.href = 'https://bantustreamconnect.com/create-communitypulse';
    });
    
    // ✅ FIX 2: Discover Creators button - Redirect to discover-creator page
    discoverBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔍 Discover Creators clicked');
      window.location.href = 'https://bantustreamconnect.com/discover-creator';
    });
    
    buttonContainer.appendChild(postUpdateBtn);
    buttonContainer.appendChild(discoverBtn);
    
    // Replace or append the button container
    const existingContainer = sectionHeader.querySelector('.pulse-button-container');
    if (existingContainer) {
      existingContainer.replaceWith(buttonContainer);
    } else {
      sectionHeader.appendChild(buttonContainer);
    }
    
    // Store reference
    this.createBtn = postUpdateBtn;
    this.discoverBtn = discoverBtn;
  },

  async loadFeed() {
    try {
      // Check if supabase is available
      if (!window.supabaseAuth) {
        console.warn('Supabase not initialized, using mock data');
        this.loadMockData();
        return;
      }

      // Fetch posts with connected creator info and smart links
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

      this.renderFeed(posts || []);
      
    } catch (err) {
      console.error('Failed to load Pulse:', err);
      this.loadMockData();
    }
  },

  loadMockData() {
    // Mock data for demo when Supabase tables aren't ready yet
    const mockPosts = [
      {
        id: '1',
        content: 'Just dropped a new Amapiano mix! 🎧🔥 Link in the smart card below to listen while you browse.',
        post_type: 'text',
        created_at: new Date().toISOString(),
        user_profiles: {
          username: 'dj_khaya',
          full_name: 'DJ Khaya',
          avatar_url: null
        },
        pulse_smart_links: [{
          link_type: 'music',
          target_content_id: 101,
          external_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          cta_text: '🎧 Listen to Amapiano Mix 2025'
        }],
        pulse_post_media: []
      },
      {
        id: '2',
        content: 'Behind the scenes of our latest short film "Soweto Rising". Coming this Friday!',
        post_type: 'image',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        user_profiles: {
          username: 'thando_films',
          full_name: 'Thando Productions',
          avatar_url: null
        },
        pulse_smart_links: [{
          link_type: 'video',
          target_content_id: 102,
          external_url: null,
          cta_text: '🎬 Watch the trailer'
        }],
        pulse_post_media: [{
          media_url: 'https://picsum.photos/id/20/600/400',
          media_type: 'image'
        }]
      },
      {
        id: '3',
        content: 'New podcast episode: "The Future of African Music" with special guest. Link to listen!',
        post_type: 'text',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        user_profiles: {
          username: 'podcast_africa',
          full_name: 'Africa Podcast Network',
          avatar_url: null
        },
        pulse_smart_links: [{
          link_type: 'podcast',
          target_content_id: 103,
          external_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
          cta_text: '🎙️ Listen to Episode 45'
        }],
        pulse_post_media: []
      }
    ];
    
    this.renderFeed(mockPosts);
  },

  renderFeed(posts) {
    if (!this.feedContainer) return;
    
    this.feedContainer.innerHTML = '';
    
    if (!posts || posts.length === 0) {
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
      return;
    }

    posts.forEach(post => this.renderPost(post));
  },

  renderPost(post) {
    const creator = post.user_profiles || { username: 'anonymous', full_name: 'Anonymous', avatar_url: null };
    const displayName = creator.full_name || creator.username || 'Creator';
    const username = creator.username || 'creator';
    const avatarUrl = creator.avatar_url;
    
    const initials = displayName.charAt(0).toUpperCase();
    const avatarHtml = avatarUrl 
      ? `<img src="${this.fixImageUrl(avatarUrl)}" alt="${displayName}" onerror="this.src='';this.parentElement.innerHTML='${initials}';">` 
      : initials;

    const card = document.createElement('div');
    card.className = 'pulse-card';
    card.dataset.postId = post.id;
    
    // Load reaction counts from localStorage or start at 0
    const reactionCount = this.getReactionCount(post.id, 'fire');
    const repostCount = this.getRepostCount(post.id);
    const commentCount = this.getCommentCount(post.id);
    const userReacted = this.userReacted(post.id);
    const userReposted = this.userReposted(post.id);
    
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
      ${this.renderSmartLink(post.pulse_smart_links?.[0], post.id)}
      <div class="pulse-actions">
        <button class="action-btn fire-btn ${userReacted ? 'active' : ''}" data-id="${post.id}">
          <i class="fas fa-fire"></i> <span class="reaction-count">${reactionCount}</span>
        </button>
        <button class="action-btn comment-btn" data-id="${post.id}">
          <i class="fas fa-comment"></i> <span class="comment-count">${commentCount}</span>
        </button>
        <button class="action-btn repost-btn ${userReposted ? 'active' : ''}" data-id="${post.id}">
          <i class="fas fa-retweet"></i> <span class="repost-count">${repostCount}</span>
        </button>
        <button class="action-btn share-btn" data-id="${post.id}">
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
    
    // ✅ FIX 3: Attach action button handlers with working functionality
    const fireBtn = card.querySelector('.fire-btn');
    const commentBtn = card.querySelector('.comment-btn');
    const repostBtn = card.querySelector('.repost-btn');
    const shareBtn = card.querySelector('.share-btn');
    
    if (fireBtn) {
      fireBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleReaction(post.id, 'fire');
      });
    }
    
    if (commentBtn) {
      commentBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleComment(post.id);
      });
    }
    
    if (repostBtn) {
      repostBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleRepost(post.id);
      });
    }
    
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleShare(post.id);
      });
    }

    this.feedContainer.appendChild(card);
  },

  // ✅ NEW: Get reaction count from localStorage
  getReactionCount(postId, type) {
    const key = `pulse_${type}_${postId}`;
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.count || 0;
    }
    return Math.floor(Math.random() * 50); // Mock count for demo
  },
  
  // ✅ NEW: Get repost count from localStorage
  getRepostCount(postId) {
    const key = `pulse_repost_${postId}`;
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.count || 0;
    }
    return Math.floor(Math.random() * 20); // Mock count for demo
  },
  
  // ✅ NEW: Get comment count from localStorage
  getCommentCount(postId) {
    const key = `pulse_comments_${postId}`;
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.count || 0;
    }
    return Math.floor(Math.random() * 10); // Mock count for demo
  },
  
  // ✅ NEW: Check if user reacted
  userReacted(postId) {
    const key = `pulse_user_reacted_${postId}`;
    return localStorage.getItem(key) === 'true';
  },
  
  // ✅ NEW: Check if user reposted
  userReposted(postId) {
    const key = `pulse_user_reposted_${postId}`;
    return localStorage.getItem(key) === 'true';
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
        console.warn('Audio player not available');
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

  // ✅ FIX 3: Working reaction handler
  handleReaction(postId, type) {
    const btn = document.querySelector(`.fire-btn[data-id="${postId}"]`);
    if (!btn) return;
    
    const wasActive = btn.classList.contains('active');
    const countSpan = btn.querySelector('.reaction-count');
    let currentCount = parseInt(countSpan.textContent) || 0;
    
    if (wasActive) {
      // Remove reaction
      btn.classList.remove('active');
      currentCount = Math.max(0, currentCount - 1);
      localStorage.setItem(`pulse_user_reacted_${postId}`, 'false');
      this.showToast('Reaction removed', 'info');
    } else {
      // Add reaction
      btn.classList.add('active');
      currentCount++;
      localStorage.setItem(`pulse_user_reacted_${postId}`, 'true');
      this.showToast('🔥 You reacted with fire!', 'success');
    }
    
    countSpan.textContent = currentCount;
    
    // Save to localStorage
    const key = `pulse_fire_${postId}`;
    localStorage.setItem(key, JSON.stringify({ count: currentCount, updated: Date.now() }));
  },

  // ✅ FIX 3: Working comment handler - opens comment modal
  handleComment(postId) {
    console.log('💬 Comment clicked for post:', postId);
    this.showCommentModal(postId);
  },
  
  // ✅ FIX 3: Working repost handler
  handleRepost(postId) {
    const btn = document.querySelector(`.repost-btn[data-id="${postId}"]`);
    if (!btn) return;
    
    const wasActive = btn.classList.contains('active');
    const countSpan = btn.querySelector('.repost-count');
    let currentCount = parseInt(countSpan.textContent) || 0;
    
    if (wasActive) {
      // Remove repost
      btn.classList.remove('active');
      currentCount = Math.max(0, currentCount - 1);
      localStorage.setItem(`pulse_user_reposted_${postId}`, 'false');
      this.showToast('Repost removed', 'info');
    } else {
      // Add repost
      btn.classList.add('active');
      currentCount++;
      localStorage.setItem(`pulse_user_reposted_${postId}`, 'true');
      this.showToast('✅ Reposted to your profile!', 'success');
    }
    
    countSpan.textContent = currentCount;
    
    // Save to localStorage
    const key = `pulse_repost_${postId}`;
    localStorage.setItem(key, JSON.stringify({ count: currentCount, updated: Date.now() }));
  },

  // ✅ FIX 3: Working comment modal with actual functionality
  showCommentModal(postId) {
    console.log('💬 Opening comment modal for post:', postId);
    
    // Get existing comments
    const commentsKey = `pulse_comments_data_${postId}`;
    let comments = [];
    const savedComments = localStorage.getItem(commentsKey);
    if (savedComments) {
      comments = JSON.parse(savedComments);
    }
    
    const modalHtml = `
      <div id="comment-modal-${postId}" class="modal-overlay">
        <div class="modal-content" style="max-width: 500px;">
          <div class="modal-header">
            <h3><i class="fas fa-comment"></i> Comments</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
            <div id="comments-list-${postId}" class="comments-list" style="margin-bottom: 20px;">
              ${comments.length === 0 ? '<p style="color: var(--slate-grey); text-align: center;">No comments yet. Be the first to comment!</p>' : ''}
              ${comments.map(comment => `
                <div class="comment-item" style="padding: 12px; border-bottom: 1px solid var(--card-border);">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--bantu-blue), var(--warm-gold)); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
                      ${comment.authorName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <strong style="color: var(--soft-white); font-size: 14px;">${this.escapeHtml(comment.authorName || 'User')}</strong>
                      <div style="color: var(--slate-grey); font-size: 11px;">${this.formatTimeAgo(comment.timestamp)}</div>
                    </div>
                  </div>
                  <p style="color: var(--soft-white); margin: 0; font-size: 14px;">${this.escapeHtml(comment.text)}</p>
                </div>
              `).join('')}
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
    
    submitBtn.addEventListener('click', () => {
      const commentText = commentInput.value.trim();
      if (!commentText) {
        this.showToast('Please enter a comment', 'warning');
        return;
      }
      
      // Get author name
      let authorName = 'User';
      if (this.currentUser) {
        authorName = this.currentUser.full_name || this.currentUser.username || 'User';
      } else {
        const guestName = prompt('Enter your name to comment:', 'Guest');
        if (guestName) authorName = guestName;
      }
      
      // Save comment
      const newComment = {
        id: Date.now(),
        text: commentText,
        authorName: authorName,
        timestamp: new Date().toISOString()
      };
      
      comments.push(newComment);
      localStorage.setItem(commentsKey, JSON.stringify(comments));
      
      // Update comment count
      const commentCountKey = `pulse_comments_${postId}`;
      const currentCount = parseInt(localStorage.getItem(commentCountKey) || '0');
      const newCount = currentCount + 1;
      localStorage.setItem(commentCountKey, newCount.toString());
      
      // Update UI count
      const commentBtn = document.querySelector(`.comment-btn[data-id="${postId}"] .comment-count`);
      if (commentBtn) {
        commentBtn.textContent = newCount;
      }
      
      this.showToast('Comment posted!', 'success');
      closeModal();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  },

  handleShare(postId) {
    const url = `${window.location.origin}?post=${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Link copied to clipboard!', 'success');
    }).catch(() => {
      this.showToast('Share: ' + url, 'info');
    });
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
