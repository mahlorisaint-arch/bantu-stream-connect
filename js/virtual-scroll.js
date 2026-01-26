class VirtualScroll {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      itemHeight: 80,
      buffer: 5,
      batchSize: 50,
      maxItems: 1000,
      loadingIndicator: true,
      ...options
    };
    
    this.items = [];
    this.visibleItems = [];
    this.startIndex = 0;
    this.endIndex = 0;
    this.scrollTop = 0;
    this.isLoading = false;
    this.hasMore = true;
    this.observer = null;
    
    this.init();
  }
  
  init() {
    this.setupContainer();
    this.setupScrollListener();
    this.setupResizeObserver();
    this.createLoadingIndicator();
    this.createEmptyState();
  }
  
  setupContainer() {
    // Add required styles and classes
    this.container.style.position = 'relative';
    this.container.style.overflowY = 'auto';
    this.container.style.overflowX = 'hidden';
    
    // Create viewport element
    this.viewport = document.createElement('div');
    this.viewport.style.position = 'relative';
    this.viewport.style.height = '100%';
    this.container.appendChild(this.viewport);
    
    // Create content wrapper
    this.content = document.createElement('div');
    this.content.style.position = 'absolute';
    this.content.style.top = '0';
    this.content.style.left = '0';
    this.content.style.right = '0';
    this.viewport.appendChild(this.content);
    
    // Set initial height
    this.updateContainerHeight();
  }
  
  setupScrollListener() {
    let scrollTimeout;
    
    this.container.addEventListener('scroll', (e) => {
      this.scrollTop = this.container.scrollTop;
      
      // Throttle scroll events
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      scrollTimeout = setTimeout(() => {
        this.updateVisibleItems();
        this.checkForMore();
      }, 16); // ~60fps
    });
  }
  
  setupResizeObserver() {
    if ('ResizeObserver' in window) {
      this.observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          if (entry.target === this.container) {
            this.updateVisibleItems();
          }
        }
      });
      
      this.observer.observe(this.container);
    }
  }
  
  createLoadingIndicator() {
    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.className = 'virtual-scroll-loading';
    this.loadingIndicator.style.cssText = `
      text-align: center;
      padding: 20px;
      color: rgba(255, 255, 255, 0.6);
      display: none;
    `;
    this.loadingIndicator.innerHTML = `
      <div class="spinner-small"></div>
      <span>Loading more comments...</span>
    `;
    
    this.container.appendChild(this.loadingIndicator);
    
    // Add spinner styles
    const style = document.createElement('style');
    style.textContent = `
      .spinner-small {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-top-color: var(--bantu-blue);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        display: inline-block;
        margin-right: 10px;
        vertical-align: middle;
      }
    `;
    document.head.appendChild(style);
  }
  
  createEmptyState() {
    this.emptyState = document.createElement('div');
    this.emptyState.className = 'virtual-scroll-empty';
    this.emptyState.style.cssText = `
      text-align: center;
      padding: 40px 20px;
      color: rgba(255, 255, 255, 0.5);
      display: none;
    `;
    this.emptyState.innerHTML = `
      <i class="fas fa-comment-slash" style="font-size: 3rem; margin-bottom: 15px;"></i>
      <h3>No Comments Yet</h3>
      <p>Be the first to comment on this content!</p>
    `;
    
    this.container.appendChild(this.emptyState);
  }
  
  setItems(items) {
    this.items = items;
    this.hasMore = items.length > 0;
    this.updateContainerHeight();
    this.updateVisibleItems();
    
    // Show/hide empty state
    if (this.items.length === 0) {
      this.emptyState.style.display = 'block';
    } else {
      this.emptyState.style.display = 'none';
    }
  }
  
  addItem(item, position = 'bottom') {
    if (position === 'top') {
      this.items.unshift(item);
    } else {
      this.items.push(item);
    }
    
    this.updateContainerHeight();
    this.updateVisibleItems();
    
    // Scroll to new item if added to top
    if (position === 'top') {
      this.container.scrollTop = 0;
    }
  }
  
  removeItem(itemId) {
    this.items = this.items.filter(item => item.id !== itemId);
    this.updateContainerHeight();
    this.updateVisibleItems();
  }
  
  updateContainerHeight() {
    const totalHeight = this.items.length * this.options.itemHeight;
    this.viewport.style.height = `${totalHeight}px`;
  }
  
  updateVisibleItems() {
    if (!this.container || this.items.length === 0) {
      this.content.innerHTML = '';
      return;
    }
    
    const containerHeight = this.container.clientHeight;
    const itemCount = this.items.length;
    
    // Calculate visible range
    const startIndex = Math.max(
      0,
      Math.floor(this.scrollTop / this.options.itemHeight) - this.options.buffer
    );
    
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((this.scrollTop + containerHeight) / this.options.itemHeight) + this.options.buffer
    );
    
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    
    // Create visible items
    this.renderVisibleItems();
    
    // Update content position
    this.content.style.top = `${startIndex * this.options.itemHeight}px`;
  }
  
  renderVisibleItems() {
    const visibleItems = this.items.slice(this.startIndex, this.endIndex + 1);
    
    // Clear content
    this.content.innerHTML = '';
    
    // Render visible items
    visibleItems.forEach((item, index) => {
      const itemElement = this.createItemElement(item, this.startIndex + index);
      this.content.appendChild(itemElement);
    });
  }
  
  createItemElement(item, absoluteIndex) {
    const itemElement = document.createElement('div');
    itemElement.className = 'virtual-scroll-item';
    itemElement.style.cssText = `
      position: absolute;
      top: ${absoluteIndex * this.options.itemHeight}px;
      left: 0;
      right: 0;
      height: ${this.options.itemHeight}px;
      padding: 10px;
      box-sizing: border-box;
    `;
    
    // Custom renderer can be provided via options
    if (this.options.renderItem) {
      itemElement.innerHTML = this.options.renderItem(item);
    } else {
      itemElement.innerHTML = this.defaultRenderer(item);
    }
    
    return itemElement;
  }
  
  defaultRenderer(item) {
    return `
      <div style="
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 15px;
        height: 100%;
        box-sizing: border-box;
      ">
        <strong>${item.id}</strong>
        <p>${item.text || 'No content'}</p>
      </div>
    `;
  }
  
  checkForMore() {
    if (this.isLoading || !this.hasMore) return;
    
    const containerHeight = this.container.clientHeight;
    const scrollBottom = this.scrollTop + containerHeight;
    const totalHeight = this.items.length * this.options.itemHeight;
    
    // Load more when 80% scrolled
    if (scrollBottom >= totalHeight * 0.8) {
      this.loadMore();
    }
  }
  
  async loadMore() {
    if (this.isLoading || !this.options.loadMore) return;
    
    this.isLoading = true;
    this.showLoadingIndicator();
    
    try {
      const newItems = await this.options.loadMore();
      
      if (newItems && newItems.length > 0) {
        this.items = [...this.items, ...newItems];
        
        if (newItems.length < this.options.batchSize) {
          this.hasMore = false;
        }
        
        this.updateContainerHeight();
        this.updateVisibleItems();
      } else {
        this.hasMore = false;
      }
    } catch (error) {
      console.error('Error loading more items:', error);
    } finally {
      this.isLoading = false;
      this.hideLoadingIndicator();
    }
  }
  
  showLoadingIndicator() {
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = 'block';
    }
  }
  
  hideLoadingIndicator() {
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = 'none';
    }
  }
  
  clear() {
    this.items = [];
    this.visibleItems = [];
    this.startIndex = 0;
    this.endIndex = 0;
    this.hasMore = true;
    this.isLoading = false;
    
    this.content.innerHTML = '';
    this.updateContainerHeight();
    this.hideLoadingIndicator();
    this.emptyState.style.display = 'none';
  }
  
  scrollToItem(index, behavior = 'smooth') {
    const position = index * this.options.itemHeight;
    this.container.scrollTo({
      top: position,
      behavior
    });
  }
  
  refresh() {
    this.updateContainerHeight();
    this.updateVisibleItems();
  }
  
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.container.removeEventListener('scroll', this.scrollHandler);
    
    // Remove added elements
    if (this.loadingIndicator && this.loadingIndicator.parentNode) {
      this.loadingIndicator.remove();
    }
    
    if (this.emptyState && this.emptyState.parentNode) {
      this.emptyState.remove();
    }
    
    if (this.content && this.content.parentNode) {
      this.content.remove();
    }
    
    if (this.viewport && this.viewport.parentNode) {
      this.viewport.remove();
    }
    
    // Clear references
    this.container = null;
    this.items = null;
    this.visibleItems = null;
  }
}

// Comments-specific virtual scroll
class CommentsVirtualScroll extends VirtualScroll {
  constructor(container, options = {}) {
    super(container, {
      itemHeight: 100,
      buffer: 3,
      batchSize: 20,
      maxItems: 500,
      ...options
    });
    
    this.contentId = null;
    this.supabaseHelper = window.SupabaseHelper;
    this.loadedCommentIds = new Set();
  }
  
  async loadComments(contentId, initialLoad = true) {
    if (!contentId) return;
    
    this.contentId = contentId;
    
    try {
      this.showLoadingIndicator();
      this.isLoading = true;
      
      // Load initial comments
      const comments = await this.supabaseHelper.getComments(contentId);
      
      // Filter out duplicates
      const uniqueComments = comments.filter(comment => 
        !this.loadedCommentIds.has(comment.id)
      );
      
      // Store IDs to prevent duplicates
      uniqueComments.forEach(comment => {
        this.loadedCommentIds.add(comment.id);
      });
      
      if (initialLoad) {
        this.setItems(uniqueComments);
      } else {
        this.items = [...this.items, ...uniqueComments];
        this.updateContainerHeight();
        this.updateVisibleItems();
      }
      
      // Update comment count
      this.updateCommentCount();
      
      return uniqueComments;
      
    } catch (error) {
      console.error('Error loading comments:', error);
      return [];
    } finally {
      this.isLoading = false;
      this.hideLoadingIndicator();
    }
  }
  
  async addComment(commentText, userId, authorName = 'User') {
    if (!this.contentId || !commentText || !this.supabaseHelper) return null;
    
    try {
      const newComment = await this.supabaseHelper.addComment(
        this.contentId,
        commentText,
        userId,
        authorName
      );
      
      if (newComment) {
        this.loadedCommentIds.add(newComment.id);
        this.addItem(newComment, 'top');
        
        // Update comment count
        this.updateCommentCount();
        
        // Show success message
        this.showCommentAddedFeedback();
      }
      
      return newComment;
    } catch (error) {
      console.error('Error adding comment:', error);
      return null;
    }
  }
  
  updateCommentCount() {
    const countEl = document.getElementById('commentsCount');
    if (countEl) {
      countEl.textContent = `(${this.items.length})`;
    }
  }
  
  showCommentAddedFeedback() {
    const feedback = document.createElement('div');
    feedback.className = 'comment-added-feedback';
    feedback.textContent = 'Comment added!';
    feedback.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bantu-blue);
      color: white;
      padding: 10px 20px;
      border-radius: 20px;
      font-weight: 500;
      z-index: 1000;
      animation: fadeInOut 2s ease;
    `;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.remove();
      }
    }, 2000);
  }
  
  renderItem(comment) {
    const authorName = comment.author_name || comment.user_profiles?.full_name || 'User';
    const avatarUrl = comment.user_profiles?.avatar_url;
    const time = this.formatCommentTime(comment.created_at);
    const commentText = comment.comment_text || '';
    
    return `
      <div class="comment-item">
        <div class="comment-header">
          <div class="comment-avatar-sm">
            ${avatarUrl ? 
              `<img src="${this.supabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl}" alt="${authorName}">` :
              `<i class="fas fa-user-circle"></i>`
            }
          </div>
          <div class="comment-user">
            <strong>${this.escapeHtml(authorName)}</strong>
            <div class="comment-time">${time}</div>
          </div>
        </div>
        <div class="comment-content">
          ${this.escapeHtml(commentText)}
        </div>
        <div class="comment-actions">
          <button class="comment-action-btn like-btn" data-comment-id="${comment.id}">
            <i class="far fa-heart"></i>
          </button>
          <button class="comment-action-btn reply-btn" data-comment-id="${comment.id}">
            <i class="far fa-comment"></i>
          </button>
        </div>
      </div>
    `;
  }
  
  formatCommentTime(timestamp) {
    if (!timestamp) return 'Just now';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Recently';
    }
  }
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  async loadMore() {
    if (!this.contentId || this.isLoading) return [];
    
    try {
      // In a real app, you would fetch the next page of comments
      // For now, we'll return an empty array since SupabaseHelper doesn't have pagination
      return [];
    } catch (error) {
      console.error('Error loading more comments:', error);
      return [];
    }
  }
}

// Initialize comments virtual scroll
function initCommentsVirtualScroll(contentId) {
  const commentsList = document.getElementById('commentsList');
  if (!commentsList) return null;
  
  // Clear existing content
  commentsList.innerHTML = '';
  
  // Create virtual scroll instance
  const virtualScroll = new CommentsVirtualScroll(commentsList, {
    itemHeight: 120,
    buffer: 5,
    renderItem: function(comment) {
      return virtualScroll.renderItem(comment);
    },
    loadMore: function() {
      return virtualScroll.loadMore();
    }
  });
  
  // Load comments
  virtualScroll.loadComments(contentId);
  
  // Add event listeners for comment actions
  setTimeout(() => {
    virtualScroll.container.addEventListener('click', (e) => {
      const likeBtn = e.target.closest('.like-btn');
      const replyBtn = e.target.closest('.reply-btn');
      
      if (likeBtn) {
        const commentId = likeBtn.dataset.commentId;
        virtualScroll.handleLike(commentId, likeBtn);
      }
      
      if (replyBtn) {
        const commentId = replyBtn.dataset.commentId;
        virtualScroll.handleReply(commentId);
      }
    });
  }, 100);
  
  return virtualScroll;
}

// Make available globally
window.VirtualScroll = VirtualScroll;
window.CommentsVirtualScroll = CommentsVirtualScroll;
window.initCommentsVirtualScroll = initCommentsVirtualScroll;

console.log('✅ Virtual Scroll initialized');
