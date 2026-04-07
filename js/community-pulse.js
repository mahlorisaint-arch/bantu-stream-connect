/**
 * Community Pulse Feed Logic
 * Connects to Supabase pulse_posts and handles rendering.
 */
const CommunityPulse = {
  feedContainer: document.getElementById('pulse-feed'),
  createBtn: document.getElementById('create-post-btn'),

  async init() {
    if (!this.feedContainer) return;
    if (this.createBtn) this.createBtn.addEventListener('click', () => {
      alert('Post creation modal to be implemented.');
    });
    await this.loadFeed();
  },

  async loadFeed() {
    try {
      // Fetch posts with connected creator info and smart links
      const { data: posts, error } = await supabaseAuth
        .from('pulse_posts')
        .select(`
          id, content, post_type, created_at, 
          creator_id, 
          user_profiles!creator_id (username, full_name, avatar_url),
          pulse_smart_links (*),
          pulse_post_media (media_url, media_type)
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;

      this.feedContainer.innerHTML = ''; // Clear skeletons
      
      if (!posts || posts.length === 0) {
        this.feedContainer.innerHTML = '<p class="text-center" style="color:var(--slate-grey);">No updates yet. Connect with a creator!</p>';
        return;
      }

      posts.forEach(post => this.renderPost(post));
    } catch (err) {
      console.error('Failed to load Pulse:', err);
    }
  },

  renderPost(post) {
    const creator = post.user_profiles;
    const initials = creator.full_name ? creator.full_name.charAt(0) : '?';
    const avatarHtml = creator.avatar_url 
      ? `<img src="${fixAvatarUrl(creator.avatar_url)}" alt="${creator.full_name}">` 
      : initials;

    const card = document.createElement('div');
    card.className = 'pulse-card';
    card.innerHTML = `
      <div class="pulse-header">
        <div class="pulse-avatar">${avatarHtml}</div>
        <div class="pulse-creator-info">
          <h4>${escapeHtml(creator.full_name || creator.username)}</h4>
          <span>@${escapeHtml(creator.username)} • ${formatTimeAgo(post.created_at)}</span>
        </div>
      </div>
      <div class="pulse-content">${escapeHtml(post.content)}</div>
      ${this.renderMedia(post)}
      ${this.renderSmartLink(post.pulse_smart_links?.[0])}
      <div class="pulse-actions">
        <button class="action-btn fire-btn" data-id="${post.id}"><i class="fas fa-fire"></i> Fire</button>
        <button class="action-btn comment-btn"><i class="fas fa-comment"></i> Comment</button>
        <button class="action-btn share-btn"><i class="fas fa-share"></i> Share</button>
      </div>
    `;

    // Attach Smart Link Event
    const linkCard = card.querySelector('.smart-link-card');
    if (linkCard && post.pulse_smart_links?.[0]) {
      const link = post.pulse_smart_links[0];
      linkCard.addEventListener('click', () => {
        if (link.link_type === 'music' || link.link_type === 'podcast') {
          // Trigger global audio player
          // In a real app, fetch content details here first
          window.playSmartLink(link.external_url || 'demo.mp3', 'Track via SmartLink', creator.full_name);
        } else if (link.target_content_id) {
          window.location.href = `content-detail.html?id=${link.target_content_id}`;
        }
      });
    }

    this.feedContainer.appendChild(card);
  },

  renderMedia(post) {
    if (!post.pulse_post_media?.length) return '';
    const media = post.pulse_post_media[0];
    if (media.media_type === 'image') {
      return `<div class="pulse-media"><img src="${fixMediaUrl(media.media_url)}" loading="lazy"></div>`;
    }
    return '';
  },

  renderSmartLink(link) {
    if (!link) return '';
    const iconMap = { music: 'fa-music', video: 'fa-video', podcast: 'fa-podcast', article: 'fa-newspaper' };
    const icon = iconMap[link.link_type] || 'fa-link';
    
    return `
      <div class="smart-link-card">
        <div class="smart-link-icon"><i class="fas ${icon}"></i></div>
        <div class="smart-link-info">
          <h5>🔗 ${link.link_type.toUpperCase()} LINK</h5>
          <p>${escapeHtml(link.cta_text)}</p>
        </div>
      </div>
    `;
  }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => CommunityPulse.init());
