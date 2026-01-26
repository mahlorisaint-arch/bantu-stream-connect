class KeyboardNavigation {
  constructor() {
    this.shortcuts = new Map();
    this.focusTrap = null;
    this.lastFocusedElement = null;
    this.isModalOpen = false;
    this.volumeStep = 0.05;
    this.seekStep = 5;
    this.isEnabled = true;
    this.helpDialog = null;
    
    this.init();
  }
  
  init() {
    this.setupGlobalListeners();
    this.setupFocusManagement();
    this.registerDefaultShortcuts();
    this.createHelpDialog();
    this.addFeedbackStyles();
  }
  
  setupGlobalListeners() {
    document.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    }, true);
    
    document.addEventListener('keydown', (e) => {
      this.preventDefaultForShortcuts(e);
    });
  }
  
  setupFocusManagement() {
    document.addEventListener('focusin', (e) => {
      this.lastFocusedElement = e.target;
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && this.isModalOpen) {
        this.handleModalTab(e);
      }
    });
    
    this.createSkipToContentLink();
  }
  
  createSkipToContentLink() {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-to-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 0;
      background: var(--bantu-blue);
      color: white;
      padding: 8px 16px;
      z-index: 10000;
      transition: top 0.3s ease;
    `;
    
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '0';
    });
    
    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
  }
  
  registerDefaultShortcuts() {
    // Global shortcuts
    this.registerShortcut('?', () => this.toggleHelp(), 'Show keyboard shortcuts');
    this.registerShortcut('k', () => this.togglePlayback(), 'Play/Pause video');
    this.registerShortcut('space', () => this.togglePlayback(), 'Play/Pause video');
    this.registerShortcut('f', () => this.toggleFullscreen(), 'Toggle fullscreen');
    this.registerShortcut('m', () => this.toggleMute(), 'Toggle mute');
    
    // Navigation shortcuts
    this.registerShortcut('arrowleft', () => this.seekBackward(), 'Seek backward 5 seconds');
    this.registerShortcut('arrowright', () => this.seekForward(), 'Seek forward 5 seconds');
    this.registerShortcut('arrowup', () => this.increaseVolume(), 'Increase volume');
    this.registerShortcut('arrowdown', () => this.decreaseVolume(), 'Decrease volume');
    this.registerShortcut('0', () => this.seekTo(0), 'Go to start');
    this.registerShortcut('1-9', (key) => this.seekToPercentage(parseInt(key)), 'Go to 10%-90% of video');
    
    // UI navigation
    this.registerShortcut('escape', () => this.handleEscape(), 'Close modal/dialog');
    this.registerShortcut('shift+?', () => this.toggleShortcuts(), 'Enable/disable shortcuts');
    
    // Content-detail specific
    this.registerShortcut('s', () => this.handleShare(), 'Share content');
    this.registerShortcut('d', () => this.handleFavorite(), 'Toggle favorite');
    this.registerShortcut('c', () => this.handleComment(), 'Focus comment input');
  }
  
  registerShortcut(key, handler, description) {
    const normalizedKey = this.normalizeKey(key);
    this.shortcuts.set(normalizedKey, {
      handler,
      description,
      key
    });
  }
  
  normalizeKey(key) {
    return key.toLowerCase().replace(/\s+/g, '');
  }
  
  handleKeyDown(event) {
    if (!this.isEnabled) return;
    
    if (this.isTypingInInput(event.target)) {
      return;
    }
    
    const key = this.getKeyFromEvent(event);
    const shortcut = this.shortcuts.get(key);
    
    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();
      
      try {
        shortcut.handler(event.key || key);
        this.showShortcutFeedback(shortcut.description);
      } catch (error) {
        console.error('Shortcut handler error:', error);
      }
    }
  }
  
  getKeyFromEvent(event) {
    const keys = [];
    
    if (event.ctrlKey) keys.push('ctrl');
    if (event.shiftKey) keys.push('shift');
    if (event.altKey) keys.push('alt');
    if (event.metaKey) keys.push('meta');
    
    let key = event.key.toLowerCase();
    
    // Handle special keys
    if (key === ' ') key = 'space';
    if (key === 'escape') key = 'escape';
    if (key === 'arrowleft') key = 'arrowleft';
    if (key === 'arrowright') key = 'arrowright';
    if (key === 'arrowup') key = 'arrowup';
    if (key === 'arrowdown') key = 'arrowdown';
    
    keys.push(key);
    
    return keys.join('+');
  }
  
  isTypingInInput(element) {
    const inputTypes = ['input', 'textarea', 'select'];
    const contentEditable = element.contentEditable === 'true';
    
    if (inputTypes.includes(element.tagName.toLowerCase())) {
      return element.type !== 'range' && element.type !== 'checkbox' && element.type !== 'radio';
    }
    
    return contentEditable;
  }
  
  preventDefaultForShortcuts(event) {
    const key = this.getKeyFromEvent(event);
    
    if (this.shortcuts.has(key)) {
      event.preventDefault();
    }
    
    if ((key === 'space' || key === 'k') && 
        event.target.tagName === 'VIDEO') {
      event.preventDefault();
    }
  }
  
  // Shortcut Handlers
  togglePlayback() {
    const video = document.querySelector('video');
    if (!video) return;
    
    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  }
  
  seekForward(seconds = this.seekStep) {
    const video = document.querySelector('video');
    if (!video) return;
    
    video.currentTime = Math.min(video.duration, video.currentTime + seconds);
  }
  
  seekBackward(seconds = this.seekStep) {
    const video = document.querySelector('video');
    if (!video) return;
    
    video.currentTime = Math.max(0, video.currentTime - seconds);
  }
  
  increaseVolume() {
    const video = document.querySelector('video');
    if (!video) return;
    
    video.volume = Math.min(1, video.volume + this.volumeStep);
  }
  
  decreaseVolume() {
    const video = document.querySelector('video');
    if (!video) return;
    
    video.volume = Math.max(0, video.volume - this.volumeStep);
  }
  
  toggleMute() {
    const video = document.querySelector('video');
    if (!video) return;
    
    video.muted = !video.muted;
  }
  
  toggleFullscreen() {
    const videoContainer = document.querySelector('.video-container') || 
                          document.querySelector('video')?.parentElement;
    
    if (!videoContainer) return;
    
    if (!document.fullscreenElement) {
      if (videoContainer.requestFullscreen) {
        videoContainer.requestFullscreen();
      } else if (videoContainer.webkitRequestFullscreen) {
        videoContainer.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }
  
  seekTo(time) {
    const video = document.querySelector('video');
    if (!video) return;
    
    video.currentTime = time;
  }
  
  seekToPercentage(percent) {
    const video = document.querySelector('video');
    if (!video || !video.duration) return;
    
    const time = (percent / 10) * video.duration;
    video.currentTime = time;
  }
  
  handleEscape() {
    const modals = document.querySelectorAll('.modal-overlay, .dialog-overlay');
    modals.forEach(modal => {
      if (modal.style.display !== 'none') {
        modal.style.display = 'none';
      }
    });
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    dropdowns.forEach(dropdown => {
      dropdown.style.display = 'none';
    });
    
    this.isModalOpen = false;
  }
  
  toggleShortcuts() {
    this.isEnabled = !this.isEnabled;
    
    this.showShortcutFeedback(
      `Keyboard shortcuts ${this.isEnabled ? 'enabled' : 'disabled'}`
    );
  }
  
  handleShare() {
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.click();
  }
  
  handleFavorite() {
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) favoriteBtn.click();
  }
  
  handleComment() {
    const commentInput = document.getElementById('commentInput');
    if (commentInput) {
      commentInput.focus();
      this.showShortcutFeedback('Comment input focused');
    }
  }
  
  // Modal focus trap
  handleModalTab(event) {
    const modal = document.querySelector('.modal-overlay:not([style*="none"])');
    if (!modal) return;
    
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }
  
  // Help dialog
  createHelpDialog() {
    this.helpDialog = document.createElement('div');
    this.helpDialog.className = 'keyboard-help-dialog';
    this.helpDialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 30px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      z-index: 2000;
      display: none;
      backdrop-filter: blur(10px);
    `;
    
    this.updateHelpDialogContent();
    document.body.appendChild(this.helpDialog);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-help-btn';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
      position: absolute;
      top: 15px;
      right: 15px;
      background: transparent;
      border: none;
      color: var(--soft-white);
      font-size: 1.2rem;
      cursor: pointer;
    `;
    
    closeBtn.addEventListener('click', () => {
      this.hideHelp();
    });
    
    this.helpDialog.appendChild(closeBtn);
    
    this.helpDialog.addEventListener('click', (e) => {
      if (e.target === this.helpDialog) {
        this.hideHelp();
      }
    });
  }
  
  updateHelpDialogContent() {
    const categories = {
      'Playback Controls': [
        ['Space / K', 'Play/Pause'],
        ['F', 'Toggle fullscreen'],
        ['M', 'Toggle mute'],
        ['Arrow Left/Right', 'Seek 5 seconds'],
        ['Arrow Up/Down', 'Volume control'],
        ['0-9', 'Jump to 0-90%']
      ],
      'Navigation': [
        ['Esc', 'Close modal/dialog'],
        ['Tab', 'Navigate forward'],
        ['Shift + Tab', 'Navigate backward'],
        ['?', 'Show this help']
      ],
      'Content Actions': [
        ['S', 'Share content'],
        ['D', 'Toggle favorite'],
        ['C', 'Focus comment']
      ]
    };
    
    let html = '<h2>Keyboard Shortcuts</h2>';
    
    for (const [category, shortcuts] of Object.entries(categories)) {
      html += `<h3>${category}</h3>`;
      html += '<div class="shortcuts-grid">';
      
      shortcuts.forEach(([key, description]) => {
        html += `
          <div class="shortcut-item">
            <kbd>${key}</kbd>
            <span>${description}</span>
          </div>
        `;
      });
      
      html += '</div>';
    }
    
    html += `
      <div class="help-footer">
        <p><i class="fas fa-info-circle"></i> These shortcuts work when video is focused and you're not typing.</p>
        <button id="disableShortcutsBtn" class="btn-secondary">
          ${this.isEnabled ? 'Disable Shortcuts' : 'Enable Shortcuts'}
        </button>
      </div>
    `;
    
    this.helpDialog.innerHTML = html + this.helpDialog.innerHTML;
    
    const disableBtn = this.helpDialog.querySelector('#disableShortcutsBtn');
    if (disableBtn) {
      disableBtn.addEventListener('click', () => {
        this.toggleShortcuts();
        this.updateHelpDialogContent();
      });
    }
  }
  
  toggleHelp() {
    if (this.helpDialog.style.display === 'block') {
      this.hideHelp();
    } else {
      this.showHelp();
    }
  }
  
  showHelp() {
    this.updateHelpDialogContent();
    this.helpDialog.style.display = 'block';
    this.isModalOpen = true;
    
    const focusable = this.helpDialog.querySelector('button, [href], input');
    if (focusable) focusable.focus();
  }
  
  hideHelp() {
    this.helpDialog.style.display = 'none';
    this.isModalOpen = false;
    
    if (this.lastFocusedElement) {
      this.lastFocusedElement.focus();
    }
  }
  
  showShortcutFeedback(message) {
    const existing = document.querySelector('.shortcut-feedback');
    if (existing) existing.remove();
    
    const feedback = document.createElement('div');
    feedback.className = 'shortcut-feedback';
    feedback.textContent = message;
    feedback.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--card-bg);
      color: var(--soft-white);
      padding: 12px 24px;
      border-radius: 8px;
      border: 1px solid var(--card-border);
      font-weight: 500;
      z-index: 1000;
      animation: fadeInOut 2s ease;
      backdrop-filter: blur(10px);
    `;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.remove();
      }
    }, 2000);
  }
  
  addFeedbackStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
        15% { opacity: 1; transform: translateX(-50%) translateY(0); }
        85% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
      
      .shortcuts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 15px;
        margin-bottom: 30px;
      }
      
      .shortcut-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        border: 1px solid var(--card-border);
      }
      
      .shortcut-item kbd {
        background: var(--deep-navy);
        padding: 4px 8px;
        border-radius: 4px;
        font-family: monospace;
        border: 1px solid var(--card-border);
        min-width: 80px;
        text-align: center;
      }
      
      .help-footer {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid var(--card-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .help-footer p {
        margin: 0;
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
      }
      
      .help-footer i {
        margin-right: 8px;
        color: var(--bantu-blue);
      }
    `;
    
    document.head.appendChild(style);
  }
  
  getShortcuts() {
    return Array.from(this.shortcuts.entries()).map(([key, data]) => ({
      key: data.key,
      description: data.description
    }));
  }
  
  enableShortcut(key) {
    const normalizedKey = this.normalizeKey(key);
    const shortcut = this.shortcuts.get(normalizedKey);
    if (shortcut) {
      shortcut.disabled = false;
    }
  }
  
  disableShortcut(key) {
    const normalizedKey = this.normalizeKey(key);
    const shortcut = this.shortcuts.get(normalizedKey);
    if (shortcut) {
      shortcut.disabled = true;
    }
  }
  
  registerCustomShortcut(key, handler, description) {
    this.registerShortcut(key, handler, description);
  }
}

// Initialize keyboard navigation
const keyboardNavigation = new KeyboardNavigation();

// Make available globally
window.keyboardNavigation = keyboardNavigation;

console.log('✅ Keyboard Navigation initialized');
