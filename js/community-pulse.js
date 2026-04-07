/**
 * Community Pulse Feed Logic
 * Connects to Supabase pulse_posts and handles rendering.
 * INTEGRATED: Smart Links now trigger the global audio player
 */
const CommunityPulse = {
  feedContainer: document.getElementById('pulse-feed'),
  createBtn: document.getElementById('create-post-btn'),
  currentUser: null,

  async init() {
    if (!this.feedContainer) return;
    
    // Get current user
    await this.getCurrentUser();
    
    if (this.createBtn) {
      this.createBtn.addEventListener('click', () => this.showCreatePostModal());
    }
    
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
        }
      }
    } catch (err) {
      console.log('User not logged in:', err);
    }
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
          window.location.href = 'explore-screen.html';
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
        <button class="action-btn fire-btn" data-id="${post.id}">
          <i class="fas fa-fire"></i> <span class="reaction-count">0</span>
        </button>
        <button class="action-btn comment-btn" data-id="${post.id}">
          <i class="fas fa-comment"></i> <span class="comment-count">0</span>
        </button>
        <button class="action-btn repost-btn" data-id="${post.id}">
          <i class="fas fa-retweet"></i> <span class="repost-count">0</span>
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
    
    // Attach action button handlers
    const fireBtn = card.querySelector('.fire-btn');
    const commentBtn = card.querySelector('.comment-btn');
    const repostBtn = card.querySelector('.repost-btn');
    const shareBtn = card.querySelector('.share-btn');
    
    if (fireBtn) fireBtn.addEventListener('click', () => this.handleReaction(post.id, 'fire'));
    if (commentBtn) commentBtn.addEventListener('click', () => this.showCommentModal(post.id));
    if (repostBtn) repostBtn.addEventListener('click', () => this.handleRepost(post.id));
    if (shareBtn) shareBtn.addEventListener('click', () => this.handleShare(post.id));

    this.feedContainer.appendChild(card);
  },

  handleSmartLinkClick(link, creatorName) {
    if (!link) return;
    
    const { link_type, target_content_id, external_url, cta_text } = link;
    
    if (link_type === 'music' || link_type === 'podcast') {
      // Use the global audio player
      let audioUrl = external_url;
      let trackTitle = cta_text || `${link_type.toUpperCase()} Track`;
      
      // For demo, use sample audio if no URL provided
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

  async handleReaction(postId, type) {
    if (!this.currentUser) {
      this.showToast('Sign in to react to posts', 'warning');
      return;
    }
    
    // Update UI optimistically
    const btn = document.querySelector(`.fire-btn[data-id="${postId}"]`);
    if (btn) {
      btn.classList.toggle('active');
      const countSpan = btn.querySelector('.reaction-count');
      if (countSpan) {
        const current = parseInt(countSpan.textContent) || 0;
        countSpan.textContent = btn.classList.contains('active') ? current + 1 : Math.max(0, current - 1);
      }
    }
    
    this.showToast('Reaction added!', 'success');
  },

  showCommentModal(postId) {
    this.showToast('Comment feature coming soon!', 'info');
  },

  async handleRepost(postId) {
    if (!this.currentUser) {
      this.showToast('Sign in to repost', 'warning');
      return;
    }
    this.showToast('Reposted to your feed!', 'success');
  },

  handleShare(postId) {
    const url = `${window.location.origin}?post=${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Link copied to clipboard!', 'success');
    }).catch(() => {
      this.showToast('Share: ' + url, 'info');
    });
  },

  showCreatePostModal() {
    if (!this.currentUser) {
      this.showToast('Sign in to create posts', 'warning');
      return;
    }
    
    const modalHtml = `
      <div id="create-post-modal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fas fa-pen"></i> Create Post</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <textarea id="post-content" placeholder="Share an update, behind-the-scenes moment, or announcement..." rows="4"></textarea>
            <div class="post-type-selector">
              <button class="post-type-btn active" data-type="text">📝 Text</button>
              <button class="post-type-btn" data-type="image">🖼️ Image</button>
            </div>
            <div id="image-upload-area" style="display: none;">
              <input type="file" id="post-image" accept="image/*">
            </div>
          </div>
          <div class="modal-footer">
            <button class="cancel-btn">Cancel</button>
            <button class="submit-btn">Post</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('create-post-modal');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const submitBtn = modal.querySelector('.submit-btn');
    const postContent = document.getElementById('post-content');
    
    const closeModal = () => modal.remove();
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    submitBtn.addEventListener('click', async () => {
      const content = postContent.value.trim();
      if (!content) {
        this.showToast('Please enter some content', 'warning');
        return;
      }
      this.showToast('Post created! (Demo mode)', 'success');
      closeModal();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
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
