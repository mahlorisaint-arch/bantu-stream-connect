// ============================================
// COLLECTIONS-RENDER - COLLECTIONS GRID
// ============================================

// ===== GET COLLECTION ITEM COUNT =====
function getCollectionItemCount(collection) {
  return collection.playlist_contents?.length || 0;
}

// ===== GET COLLECTION THUMBNAIL =====
function getCollectionThumbnail(collection) {
  if (collection.custom_thumbnail_url) {
    return fixMediaUrl(collection.custom_thumbnail_url);
  }
  const firstItem = collection.playlist_contents?.[0];
  if (firstItem?.Content?.thumbnail_url) {
    return fixMediaUrl(firstItem.Content.thumbnail_url);
  }
  return "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&h=225&fit=crop";
}

// ===== GET TYPE ICON =====
function getTypeIcon(type) {
  switch(type) {
    case 'album': return 'fa-compact-disc';
    case 'podcast': return 'fa-podcast';
    case 'series': return 'fa-tv';
    default: return 'fa-list';
  }
}

// ===== RENDER COLLECTIONS GRID =====
async function renderCollectionsGrid() {
  const collections = await loadCollections();
  const grid = document.getElementById("collectionsGrid");
  if (!grid) return;
  
  if (!collections || collections.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;">
        <i class="fas fa-layer-group" style="font-size:48px;opacity:0.3;margin-bottom:20px;"></i>
        <h3>No Collections Yet</h3>
        <p style="color:var(--slate-grey);">Create your first playlist, album, or series</p>
        ${window.currentUser && window.currentUser.id === window.creatorId ?
          '<button id="createFirstCollectionBtn" class="primary-btn" style="margin-top:20px;"><i class="fas fa-plus"></i> Create Collection</button>' :
          ''}
      </div>
    `;
    const createBtn = document.getElementById('createFirstCollectionBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => openPlaylistBuilder());
    }
    return;
  }
  
  grid.innerHTML = collections.map(collection => {
    const thumbnail = getCollectionThumbnail(collection);
    const itemCount = getCollectionItemCount(collection);
    const typeLabel = collection.playlist_type || 'playlist';
    const typeIcon = getTypeIcon(typeLabel);
    
    return `
      <div class="collection-card" data-collection-id="${collection.id}" data-collection-type="${typeLabel}">
        <div class="collection-thumb-wrapper">
          <img class="collection-thumb" src="${thumbnail}" alt="${escapeHtml(collection.name)}" loading="lazy">
          <div class="collection-overlay">
            <i class="fas fa-play"></i>
          </div>
          <div class="collection-type-badge ${typeLabel}">
            <i class="fas ${typeIcon}"></i> ${typeLabel}
          </div>
          <div class="collection-count-badge">
            <i class="fas fa-list"></i> ${itemCount}
          </div>
        </div>
        <div class="collection-body">
          <div class="collection-title" title="${escapeHtml(collection.name)}">${truncateText(escapeHtml(collection.name), 40)}</div>
          <div class="collection-meta">
            <span><i class="fas ${typeIcon}"></i> ${typeLabel.toUpperCase()}</span>
            <span><i class="fas fa-video"></i> ${itemCount} ${itemCount === 1 ? 'item' : 'items'}</span>
          </div>
          ${collection.description ? `<div class="collection-desc">${truncateText(escapeHtml(collection.description), 60)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  grid.querySelectorAll('.collection-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const collectionId = card.dataset.collectionId;
      const collectionType = card.dataset.collectionType;
      if (collectionId) {
        window.location.href = `content-detail.html?playlist_id=${collectionId}&type=${collectionType}`;
      }
    });
  });
}

// Make functions globally available
window.getCollectionItemCount = getCollectionItemCount;
window.getCollectionThumbnail = getCollectionThumbnail;
window.getTypeIcon = getTypeIcon;
window.renderCollectionsGrid = renderCollectionsGrid;
