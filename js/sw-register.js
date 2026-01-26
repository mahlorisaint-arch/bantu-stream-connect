class ServiceWorkerManager {
  constructor() {
    this.swRegistration = null;
    this.isSupported = 'serviceWorker' in navigator;
    this.updateFound = false;
    this.wasOffline = false;
    
    if (this.isSupported) {
      this.init();
    }
  }
  
  async init() {
    try {
      this.swRegistration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      
      console.log('[Service Worker] Registered successfully');
      
      this.setupUpdateListener();
      this.setupPeriodicUpdateCheck();
      this.setupOfflineDetection();
      
    } catch (error) {
      console.error('[Service Worker] Registration failed:', error);
    }
  }
  
  setupUpdateListener() {
    if (!this.swRegistration) return;
    
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[Service Worker] Controller changed');
      this.showUpdateNotification();
    });
    
    this.swRegistration.addEventListener('updatefound', () => {
      console.log('[Service Worker] Update found');
      this.updateFound = true;
      
      const newWorker = this.swRegistration.installing;
      
      newWorker.addEventListener('statechange', () => {
        console.log('[Service Worker] New worker state:', newWorker.state);
        
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          this.showUpdateReadyNotification();
        }
      });
    });
  }
  
  setupPeriodicUpdateCheck() {
    setInterval(() => {
      if (this.swRegistration) {
        this.swRegistration.update().catch(error => {
          console.log('[Service Worker] Update check failed:', error);
        });
      }
    }, 60 * 60 * 1000);
  }
  
  setupOfflineDetection() {
    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine;
      document.documentElement.classList.toggle('offline', !isOnline);
      
      window.dispatchEvent(new CustomEvent('network-status', {
        detail: { online: isOnline }
      }));
      
      if (!isOnline) {
        this.showOfflineNotification();
      } else if (this.wasOffline) {
        this.showOnlineNotification();
        this.wasOffline = false;
      }
      
      this.wasOffline = !isOnline;
    };
    
    updateOnlineStatus();
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }
  
  showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'toast info update-toast';
    notification.innerHTML = `
      <i class="fas fa-sync-alt"></i>
      <span>New version available</span>
      <button id="reloadBtn" class="toast-btn">Reload</button>
    `;
    
    document.body.appendChild(notification);
    
    notification.querySelector('#reloadBtn').addEventListener('click', () => {
      window.location.reload();
    });
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }
  
  showUpdateReadyNotification() {
    const notification = document.createElement('div');
    notification.className = 'toast warning update-ready-toast';
    notification.innerHTML = `
      <i class="fas fa-download"></i>
      <span>Update ready. Reload to apply.</span>
      <button id="applyUpdateBtn" class="toast-btn">Apply Now</button>
    `;
    
    document.body.appendChild(notification);
    
    notification.querySelector('#applyUpdateBtn').addEventListener('click', () => {
      if (this.swRegistration?.waiting) {
        this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    });
  }
  
  showOfflineNotification() {
    const notification = document.createElement('div');
    notification.className = 'toast warning offline-toast';
    notification.innerHTML = `
      <i class="fas fa-wifi-slash"></i>
      <span>You are offline. Some features may be limited.</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }
  
  showOnlineNotification() {
    const notification = document.createElement('div');
    notification.className = 'toast success online-toast';
    notification.innerHTML = `
      <i class="fas fa-wifi"></i>
      <span>You are back online!</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }
  
  async checkForUpdate() {
    if (!this.swRegistration) return false;
    
    try {
      await this.swRegistration.update();
      return this.updateFound;
    } catch (error) {
      console.error('[Service Worker] Manual update check failed:', error);
      return false;
    }
  }
  
  async clearCache() {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[Service Worker] Cache cleared');
      return true;
    } catch (error) {
      console.error('[Service Worker] Failed to clear cache:', error);
      return false;
    }
  }
}

// Initialize service worker manager
const serviceWorkerManager = new ServiceWorkerManager();

// Make available globally
window.serviceWorkerManager = serviceWorkerManager;

console.log('✅ Service Worker Manager initialized');
