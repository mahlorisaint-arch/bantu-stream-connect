// Accessibility Utilities
class Accessibility {
    static init() {
        this.setupSkipLink();
        this.setupFocusManagement();
        this.setupKeyboardNavigation();
        this.setupAriaLabels();
        this.setupReducedMotion();
    }
    
    static setupSkipLink() {
        const skipLink = document.getElementById('skip-link');
        if (skipLink) {
            skipLink.addEventListener('click', (e) => {
                e.preventDefault();
                const mainContent = document.getElementById('main-content');
                if (mainContent) {
                    mainContent.tabIndex = -1;
                    mainContent.focus();
                    setTimeout(() => {
                        mainContent.removeAttribute('tabindex');
                    }, 1000);
                }
            });
        }
    }
    
    static setupFocusManagement() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                this.handleTabKey(e);
            }
        });
    }
    
    static handleTabKey(e) {
        const modal = document.querySelector('.search-modal.active, .analytics-modal.active, .notifications-panel.active');
        if (!modal) return;
        
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }
    
    static setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' || 
                e.target.isContentEditable) {
                return;
            }
            
            // Alt+N for notifications
            if (e.altKey && e.key === 'n') {
                e.preventDefault();
                document.getElementById('notifications-btn')?.click();
            }
            
            // Alt+A for analytics
            if (e.altKey && e.key === 'a') {
                e.preventDefault();
                document.getElementById('analytics-btn')?.click();
            }
            
            // Alt+H for home
            if (e.altKey && e.key === 'h') {
                e.preventDefault();
                window.location.href = 'index.html';
            }
            
            // Alt+P for profile
            if (e.altKey && e.key === 'p') {
                e.preventDefault();
                document.getElementById('profile-btn')?.click();
            }
            
            // Alt+T for theme
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                document.getElementById('nav-theme-toggle')?.click();
            }
            
            // Escape to close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
            
            // Question mark for shortcuts help
            if (e.key === '?') {
                e.preventDefault();
                this.toggleShortcutsHelp();
            }
        });
    }
    
    static closeAllModals() {
        document.querySelectorAll('.search-modal.active, .analytics-modal.active, .notifications-panel.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.getElementById('theme-selector')?.classList.remove('active');
    }
    
    static toggleShortcutsHelp() {
        const helpModal = document.getElementById('keyboard-shortcuts-help');
        if (helpModal) {
            helpModal.classList.toggle('active');
        }
    }
    
    static setupAriaLabels() {
        document.querySelectorAll('button:not([aria-label]), a:not([aria-label])').forEach(element => {
            const text = element.textContent.trim();
            if (text && !element.getAttribute('aria-label')) {
                element.setAttribute('aria-label', text);
            }
        });
        
        // Add aria-live region for dynamic content
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.position = 'absolute';
        liveRegion.style.left = '-9999px';
        document.body.appendChild(liveRegion);
    }
    
    static setupReducedMotion() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion) {
            const style = document.createElement('style');
            style.textContent = `
                *, *::before, *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Animation Utilities
class Animations {
    static init() {
        this.setupLazyAnimations();
        this.setupSmoothScrolling();
    }
    
    static setupLazyAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        
        // Observe elements with animation classes
        document.querySelectorAll('.content-card, .section, .development-card').forEach(el => {
            observer.observe(el);
        });
    }
    
    static setupSmoothScrolling() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }
    
    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const opacity = Math.min(progress / duration, 1);
            element.style.opacity = opacity.toString();
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    static fadeOut(element, duration = 300) {
        let start = null;
        const initialOpacity = parseFloat(window.getComputedStyle(element).opacity);
        
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const opacity = Math.max(initialOpacity - (progress / duration), 0);
            element.style.opacity = opacity.toString();
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        };
        
        requestAnimationFrame(animate);
    }
}

// DOM Helper Utilities
class DOMHelpers {
    static createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Append children
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    }
    
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    static getScrollPosition() {
        return {
            x: window.pageXOffset || document.documentElement.scrollLeft,
            y: window.pageYOffset || document.documentElement.scrollTop
        };
    }
    
    static isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
    
    static loadScript(src, attributes = {}) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            
            Object.entries(attributes).forEach(([key, value]) => {
                script.setAttribute(key, value);
            });
            
            script.onload = resolve;
            script.onerror = reject;
            
            document.head.appendChild(script);
        });
    }
    
    static loadStylesheet(href) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            
            link.onload = resolve;
            link.onerror = reject;
            
            document.head.appendChild(link);
        });
    }
}

// Toast Notification System
class Toast {
    constructor() {
        this.container = null;
        this.toasts = new Set();
        this.setupContainer();
    }
    
    setupContainer() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);
        }
    }
    
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        
        this.container.appendChild(toast);
        this.toasts.add(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);
        
        // Auto remove
        const removeToast = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(100%)';
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                this.toasts.delete(toast);
            }, 300);
        };
        
        const timeout = setTimeout(removeToast, duration);
        
        // Allow click to dismiss
        toast.addEventListener('click', () => {
            clearTimeout(timeout);
            removeToast();
        });
        
        // Add close button for longer messages
        if (message.length > 100) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close';
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            closeBtn.setAttribute('aria-label', 'Close notification');
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                clearTimeout(timeout);
                removeToast();
            });
            
            toast.style.paddingRight = '40px';
            toast.appendChild(closeBtn);
        }
        
        return toast;
    }
    
    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }
    
    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }
    
    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
    
    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    }
    
    clearAll() {
        this.toasts.forEach(toast => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
        this.toasts.clear();
    }
}

// Unified touch handler for mobile compatibility
function unifiedTap(element, callback, delay = 300) {
    let tapTimeout;
    let startX, startY;
    
    element.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });
    
    element.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        
        // Check if it was a tap (not a swipe)
        if (Math.abs(endX - startX) < 10 && Math.abs(endY - startY) < 10) {
            clearTimeout(tapTimeout);
            tapTimeout = setTimeout(() => callback(e), delay);
        }
    }, { passive: true });
    
    element.addEventListener('click', callback);
}

// Error boundary wrapper
function withErrorBoundary(fn, fallback) {
    return async function(...args) {
        try {
            return await fn(...args);
        } catch (error) {
            console.error('Error in function:', error);
            if (fallback) {
                return fallback(...args);
            }
            throw error;
        }
    };
}

// Phased loading helper
class PhasedLoader {
    constructor() {
        this.phases = [];
        this.currentPhase = 0;
    }
    
    addPhase(name, callback, priority = 0) {
        this.phases.push({ name, callback, priority });
        return this;
    }
    
    async execute() {
        // Sort by priority (higher priority first)
        this.phases.sort((a, b) => b.priority - a.priority);
        
        for (let i = 0; i < this.phases.length; i++) {
            const phase = this.phases[i];
            this.currentPhase = i;
            
            try {
                console.log(`🚀 Executing phase: ${phase.name}`);
                await phase.callback();
            } catch (error) {
                console.error(`❌ Error in phase ${phase.name}:`, error);
                // Continue with next phase
            }
        }
    }
}

// Export utilities
const toast = new Toast();
const domHelpers = DOMHelpers;
const animations = Animations;
const accessibility = Accessibility;

console.log('✅ Home Feed Utilities initialized');
