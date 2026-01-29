// Thumbnail URL Fix Helper
// ==========================================================================

// Fix all thumbnail URLs on the page
function fixAllThumbnails() {
    document.querySelectorAll('img[src*="thumbnail"], .card-thumbnail img, .search-result-thumbnail img').forEach(img => {
        const currentSrc = img.src;
        
        // If it's a Supabase storage URL without proper format
        if (currentSrc.includes('supabase.co/storage/v1/object/public/')) {
            // Ensure it has proper query parameters for optimization
            if (!currentSrc.includes('?')) {
                img.src = currentSrc + '?w=400&h=225&fit=crop&auto=format&q=80';
            }
        }
        
        // Add error handler as backup
        img.onerror = function() {
            this.src = 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop&auto=format&q=80';
            this.onerror = null; // Prevent infinite loop
        };
    });
}

// Run when page loads
document.addEventListener('DOMContentLoaded', fixAllThumbnails);

// Also run after content loads (for infinite scroll)
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            setTimeout(fixAllThumbnails, 100);
        }
    });
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});
