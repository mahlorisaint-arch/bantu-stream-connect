// js/keyboard-shortcuts.js — Content Detail Keyboard Navigation
// Bantu Stream Connect — Phase 1 Polish

(function() {
  'use strict';
  
  console.log('⌨️ Keyboard Shortcuts module loading...');
  
  function KeyboardShortcuts(config) {
    if (!config || !config.videoElement) {
      console.error('❌ KeyboardShortcuts: Missing required config (videoElement)');
      return;
    }
    
    this.video = config.videoElement;
    this.supabase = config.supabaseClient || window.supabaseClient;
    this.contentId = config.contentId || null;
    this.isEnabled = true;
    this.shortcuts = new Map();
    this.helpModal = null;
    
    this.registerDefaultShortcuts();
    this.setupGlobalListeners();
    this.createHelpModal();
    
    console.log('✅ Keyboard Shortcuts initialized');
  }
  
  KeyboardShortcuts.prototype.registerDefaultShortcuts = function() {
    // Playback controls
    this.registerShortcut(' ', () => this.togglePlay(), 'Play/Pause');
    this.registerShortcut('k', () => this.togglePlay(), 'Play/Pause');
    this.registerShortcut('f', () => this.toggleFullscreen(), 'Toggle fullscreen');
    this.registerShortcut('m', () => this.toggleMute(), 'Toggle mute');
    
    // Seeking
    this.registerShortcut('arrowleft', () => this.seekBackward(), 'Seek backward 5 seconds');
    this.registerShortcut('arrowright', () => this.seekForward(), 'Seek forward 5 seconds');
    this.registerShortcut('0', () => this.seekTo(0), 'Go to start');
    this.registerShortcut('1', () => this.seekToPercentage(10), 'Go to 10%');
    this.registerShortcut('2', () => this.seekToPercentage(20), 'Go to 20%');
    this.registerShortcut('3', () => this.seekToPercentage(30), 'Go to 30%');
    this.registerShortcut('4', () => this.seekToPercentage(40), 'Go to 40%');
    this.registerShortcut('5', () => this.seekToPercentage(50), 'Go to 50%');
    this.registerShortcut('6', () => this.seekToPercentage(60), 'Go to 60%');
    this.registerShortcut('7', () => this.seekToPercentage(70), 'Go to 70%');
    this.registerShortcut('8', () => this.seekToPercentage(80), 'Go to 80%');
    this.registerShortcut('9', () => this.seekToPercentage(90), 'Go to 90%');
    
    // Volume
    this.registerShortcut('arrowup', () => this.increaseVolume(), 'Increase volume');
    this.registerShortcut('arrowdown', () => this.decreaseVolume(), 'Decrease volume');
    
    // Playback speed
    this.registerShortcut('shift+.', () => this.increaseSpeed(), 'Increase playback speed');
    this.registerShortcut('shift+,', () => this.decreaseSpeed(), 'Decrease playback speed');
    
    // UI actions
    this.registerShortcut('escape', () => this.handleEscape(), 'Close modal/exit fullscreen');
    this.registerShortcut('?', () => this.toggleHelp(), 'Show keyboard shortcuts');
    this.registerShortcut('c', () => this.focusComment(), 'Focus comment input');
    this.registerShortcut('l', () => this.toggleLike(), 'Toggle like');
    this.registerShortcut('w', () => this.toggleWatchLater(), 'Add to Watch Later');
    this.registerShortcut('s', () => this.shareContent(), 'Share content');
    
    // Enable/disable shortcuts
    this.registerShortcut('shift+s', () => this.toggleShortcutsEnabled(), 'Enable/disable shortcuts');
  };
  
  KeyboardShortcuts.prototype.registerShortcut = function(key, handler, description) {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
    this.shortcuts.set(normalizedKey, {
      handler: handler,
      description: description,
      key: key
    });
  };
  
  KeyboardShortcuts.prototype.setupGlobalListeners = function() {
    const self = this;
    
    document.addEventListener('keydown', function(e) {
      if (!self.isEnabled) return;
      
      // Ignore if typing in input/textarea
      if (self.isTypingInInput(e.target)) return;
      
      const key = self.getKeyFromEvent(e);
      const shortcut = self.shortcuts.get(key);
      
      if (shortcut) {
        e.preventDefault();
        e.stopPropagation();
        try {
          shortcut.handler();
          self.showShortcutFeedback(shortcut.description);
        } catch (error) {
          console.error('Shortcut handler error:', error);
        }
      }
    }, true);
  };
  
  KeyboardShortcuts.prototype.getKeyFromEvent = function(event) {
    const keys = [];
    if (event.ctrlKey) keys.push('ctrl');
    if (event.shiftKey) keys.push('shift');
    if (event.altKey) keys.push('alt');
    if (event.metaKey) keys.push('meta');
    
    let key = event.key.toLowerCase();
    if (key === ' ') key = 'space';
    if (key === 'arrowleft') key = 'arrowleft';
    if (key === 'arrowright') key = 'arrowright';
    if (key === 'arrowup') key = 'arrowup';
    if (key === 'arrowdown') key = 'arrowdown';
    
    keys.push(key);
    return keys.join('+');
  };
  
  KeyboardShortcuts.prototype.isTypingInInput = function(element) {
    const inputTypes = ['input', 'textarea', 'select'];
    const contentEditable = element.contentEditable === 'true';
    if (inputTypes.includes(element.tagName.toLowerCase())) {
      return element.type !== 'range' && element.type !== 'checkbox' && element.type !== 'radio';
    }
    return contentEditable;
  };
  
  // Shortcut Handlers
  KeyboardShortcuts.prototype.togglePlay = function() {
    if (!this.video) return;
    if (this.video.paused) {
      this.video.play().catch(console.error);
    } else {
      this.video.pause();
    }
  };
  
  KeyboardShortcuts.prototype.toggleFullscreen = function() {
    const playerContainer = document.querySelector('.inline-player') || 
                           this.video.parentElement;
    if (!playerContainer) return;
    
    if (!document.fullscreenElement) {
      if (playerContainer.requestFullscreen) {
        playerContainer.requestFullscreen();
      } else if (playerContainer.webkitRequestFullscreen) {
        playerContainer.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };
  
  KeyboardShortcuts.prototype.toggleMute = function() {
    if (!this.video) return;
    this.video.muted = !this.video.muted;
  };
  
  KeyboardShortcuts.prototype.seekForward = function(seconds) {
    if (!this.video) return;
    this.video.currentTime = Math.min(
      this.video.duration, 
      this.video.currentTime + (seconds || 5)
    );
  };
  
  KeyboardShortcuts.prototype.seekBackward = function(seconds) {
    if (!this.video) return;
    this.video.currentTime = Math.max(
      0, 
      this.video.currentTime - (seconds || 5)
    );
  };
  
  KeyboardShortcuts.prototype.seekTo = function(time) {
    if (!this.video) return;
    this.video.currentTime = time;
  };
  
  KeyboardShortcuts.prototype.seekToPercentage = function(percent) {
    if (!this.video || !this.video.duration) return;
    const time = (percent / 100) * this.video.duration;
    this.video.currentTime = time;
  };
  
  KeyboardShortcuts.prototype.increaseVolume = function() {
    if (!this.video) return;
    this.video.volume = Math.min(1, this.video.volume + 0.1);
  };
  
  KeyboardShortcuts.prototype.decreaseVolume = function() {
    if (!this.video) return;
    this.video.volume = Math.max(0, this.video.volume - 0.1);
  };
  
  KeyboardShortcuts.prototype.increaseSpeed = function() {
    if (!this.video) return;
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const currentIndex = rates.indexOf(this.video.playbackRate);
    const nextIndex = Math.min(rates.length - 1, currentIndex + 1);
    this.video.playbackRate = rates[nextIndex];
  };
  
  KeyboardShortcuts.prototype.decreaseSpeed = function() {
    if (!this.video) return;
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const currentIndex = rates.indexOf(this.video.playbackRate);
    const prevIndex = Math.max(0, currentIndex - 1);
    this.video.playbackRate = rates[prevIndex];
  };
  
  KeyboardShortcuts.prototype.handleEscape = function() {
    // Close any open modals
    const modals = document.querySelectorAll('.analytics-modal.active, .search-modal.active, .notifications-panel.active');
    modals.forEach(modal => {
      if (modal.classList.contains('active')) {
        modal.classList.remove('active');
      }
    });
    
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  KeyboardShortcuts.prototype.focusComment = function() {
    const commentInput = document.getElementById('commentInput');
    if (commentInput) {
      commentInput.focus();
      this.showShortcutFeedback('Comment input focused');
    }
  };
  
  KeyboardShortcuts.prototype.toggleLike = function() {
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) likeBtn.click();
  };
  
  KeyboardShortcuts.prototype.toggleWatchLater = function() {
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    if (watchLaterBtn) watchLaterBtn.click();
  };
  
  KeyboardShortcuts.prototype.shareContent = function() {
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.click();
  };
  
  KeyboardShortcuts.prototype.toggleShortcutsEnabled = function() {
    this.isEnabled = !this.isEnabled;
    this.showShortcutFeedback(
      'Keyboard shortcuts ' + (this.isEnabled ? 'enabled' : 'disabled')
    );
  };
  
  KeyboardShortcuts.prototype.toggleHelp = function() {
    if (this.helpModal) {
      const isVisible = this.helpModal.style.display === 'block';
      this.helpModal.style.display = isVisible ? 'none' : 'block';
    }
  };
  
  KeyboardShortcuts.prototype.showShortcutFeedback = function(message) {
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
      if (feedback.parentNode) feedback.remove();
    }, 2000);
  };
  
  KeyboardShortcuts.prototype.createHelpModal = function() {
    const self = this;
    
    this.helpModal = document.createElement('div');
    this.helpModal.id = 'keyboard-help-modal';
    this.helpModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      z-index: 2000;
      display: none;
      align-items: center;
      justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 30px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid var(--card-border);
    `;
    
    const title = document.createElement('h2');
    title.textContent = 'Keyboard Shortcuts';
    title.style.cssText = `
      font-family: 'Orbitron', sans-serif;
      font-size: 20px;
      color: var(--soft-white);
      margin: 0;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: var(--slate-grey);
      font-size: 20px;
      cursor: pointer;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.addEventListener('click', () => {
      self.helpModal.style.display = 'none';
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    `;
    
    const categories = {
      'Playback': [
        ['Space / K', 'Play/Pause'],
        ['F', 'Fullscreen'],
        ['M', 'Mute'],
        ['← / →', 'Seek ±5s'],
        ['0-9', 'Jump to %']
      ],
      'Volume & Speed': [
        ['↑ / ↓', 'Volume'],
        ['Shift + .', 'Faster'],
        ['Shift + ,', 'Slower']
      ],
      'Actions': [
        ['L', 'Like'],
        ['W', 'Watch Later'],
        ['C', 'Comment'],
        ['S', 'Share'],
        ['?', 'Show Help']
      ],
      'Navigation': [
        ['Esc', 'Close/Exit'],
        ['Shift + S', 'Toggle Shortcuts']
      ]
    };
    
    for (const [category, shortcuts] of Object.entries(categories)) {
      const categoryTitle = document.createElement('h3');
      categoryTitle.textContent = category;
      categoryTitle.style.cssText = `
        grid-column: span 2;
        font-size: 14px;
        color: var(--warm-gold);
        margin: 15px 0 10px;
        border-bottom: 1px solid var(--card-border);
        padding-bottom: 5px;
      `;
      grid.appendChild(categoryTitle);
      
      shortcuts.forEach(([key, desc]) => {
        const item = document.createElement('div');
        item.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          border: 1px solid var(--card-border);
        `;
        
        const kbd = document.createElement('kbd');
        kbd.textContent = key;
        kbd.style.cssText = `
          background: var(--deep-navy);
          padding: 4px 8px;
          border-radius: 4px;
          font-family: monospace;
          border: 1px solid var(--card-border);
          font-size: 12px;
          color: var(--warm-gold);
        `;
        
        const label = document.createElement('span');
        label.textContent = desc;
        label.style.cssText = `
          font-size: 13px;
          color: var(--soft-white);
        `;
        
        item.appendChild(kbd);
        item.appendChild(label);
        grid.appendChild(item);
      });
    }
    
    content.appendChild(header);
    content.appendChild(grid);
    this.helpModal.appendChild(content);
    document.body.appendChild(this.helpModal);
    
    // Close on backdrop click
    this.helpModal.addEventListener('click', (e) => {
      if (e.target === this.helpModal) {
        this.helpModal.style.display = 'none';
      }
    });
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
        15% { opacity: 1; transform: translateX(-50%) translateY(0); }
        85% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
  };
  
  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyboardShortcuts;
  } else {
    window.KeyboardShortcuts = KeyboardShortcuts;
  }
  
  console.log('✅ Keyboard Shortcuts module loaded successfully');
})();
