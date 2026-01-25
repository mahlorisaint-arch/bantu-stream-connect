class Security {
  constructor() {
    // Safe HTML tags and attributes
    this.allowedTags = new Set([
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span', 
      'ul', 'ol', 'li', 'code', 'pre', 'blockquote'
    ]);
    
    this.allowedAttributes = {
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'span': ['class'],
      'code': ['class']
    };
    
    // Safe URL protocols
    this.safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
  }
  
  // Basic HTML sanitizer
  sanitizeHTML(input) {
    if (typeof input !== 'string') return '';
    
    // Remove dangerous tags and attributes
    const temp = document.createElement('div');
    temp.textContent = input;
    
    // Return sanitized text (not HTML)
    return temp.innerHTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  // Safe text rendering (for comments, descriptions, etc.)
  safeText(input) {
    return this.sanitizeHTML(input);
  }
  
  // Safe URL validation
  safeURL(url) {
    try {
      const parsed = new URL(url);
      
      // Only allow safe protocols
      if (!this.safeProtocols.includes(parsed.protocol)) {
        return 'about:blank';
      }
      
      // Prevent javascript: and data: URLs
      if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:') {
        return 'about:blank';
      }
      
      return url;
    } catch {
      // Invalid URL, return safe default
      return 'about:blank';
    }
  }
  
  // Create DOM elements safely
  createElement(tagName, attributes = {}, content = '') {
    const element = document.createElement(tagName);
    
    // Set safe attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (this.isSafeAttribute(tagName, key)) {
        if (key === 'href' || key === 'src') {
          element.setAttribute(key, this.safeURL(value));
        } else {
          element.setAttribute(key, this.safeText(value));
        }
      }
    });
    
    // Set text content (not innerHTML)
    if (content) {
      element.textContent = content;
    }
    
    return element;
  }
  
  isSafeAttribute(tagName, attribute) {
    return this.allowedAttributes[tagName]?.includes(attribute) || false;
  }
}

// Export singleton instance
const security = new Security();
