/* ============================================ */
/* PLAYLIST QUEUE SECTION MODULE */
/* Playlist/Album/Series queue sidebar and track list */
/* YouTube-style persistent playlist sidebar */
/* ============================================ */

/* ============================================ */
/* PLAYLIST QUEUE SECTION - MAIN CONTAINER */
/* ============================================ */
.playlist-queue-section {
  margin-top: 24px;
  margin-bottom: 24px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.playlist-queue-section:hover {
  border-color: rgba(29, 78, 216, 0.3);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

/* ============================================ */
/* PLAYLIST QUEUE HEADER */
/* ============================================ */
.playlist-queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--card-border);
  flex-wrap: wrap;
  gap: 12px;
}

.playlist-queue-header h2 {
  font-family: 'Orbitron', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--soft-white);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.playlist-queue-header h2 i {
  color: var(--bantu-blue);
  font-size: 18px;
}

/* Playlist metadata */
.playlist-meta-info {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: var(--slate-grey);
}

.playlist-meta-info span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.playlist-meta-info i {
  color: var(--bantu-blue);
  font-size: 11px;
}

/* Playlist actions */
.playlist-actions {
  display: flex;
  gap: 8px;
}

.playlist-action-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 6px 12px;
  color: var(--soft-white);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.playlist-action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: var(--bantu-blue);
}

.playlist-action-btn i {
  font-size: 11px;
}

/* ============================================ */
/* PLAYLIST QUEUE LIST */
/* ============================================ */
.playlist-queue-list {
  max-height: 500px;
  overflow-y: auto;
}

/* Custom scrollbar */
.playlist-queue-list::-webkit-scrollbar {
  width: 6px;
}

.playlist-queue-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.playlist-queue-list::-webkit-scrollbar-thumb {
  background: var(--bantu-blue);
  border-radius: 3px;
}

.playlist-queue-list::-webkit-scrollbar-thumb:hover {
  background: var(--warm-gold);
}

/* Queue item */
.playlist-queue-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--card-border);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.playlist-queue-item:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateX(4px);
}

/* Currently playing / active item */
.playlist-queue-item.active {
  background: rgba(29, 78, 216, 0.15);
  border-left: 3px solid var(--bantu-blue);
}

.playlist-queue-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(135deg, var(--bantu-blue), var(--warm-gold));
}

/* Playing animation for active item */
.playlist-queue-item.active .queue-thumbnail .playing-indicator {
  opacity: 1;
}

/* Queue thumbnail */
.queue-thumbnail {
  position: relative;
  width: 60px;
  height: 34px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.3);
}

.queue-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
}

.playlist-queue-item:hover .queue-thumbnail img {
  transform: scale(1.05);
}

/* Playing indicator overlay */
.playing-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.playlist-queue-item.active .playing-indicator,
.playlist-queue-item:hover .playing-indicator {
  opacity: 1;
}

.playing-indicator i {
  color: var(--warm-gold);
  font-size: 14px;
  animation: pulse 1s infinite;
}

/* Track number */
.track-number {
  min-width: 32px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--slate-grey);
  font-family: monospace;
}

.playlist-queue-item.active .track-number {
  color: var(--warm-gold);
}

/* Queue info (title and artist) */
.queue-info {
  flex: 1;
  min-width: 0;
}

.queue-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--soft-white);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-queue-item.active .queue-title {
  color: var(--bantu-blue);
}

.queue-artist {
  font-size: 11px;
  color: var(--slate-grey);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Queue duration */
.queue-duration {
  font-size: 12px;
  color: var(--slate-grey);
  font-family: monospace;
  min-width: 45px;
  text-align: right;
}

/* Queue actions (play, menu buttons) */
.queue-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.playlist-queue-item:hover .queue-actions {
  opacity: 1;
}

.queue-action-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--slate-grey);
  cursor: pointer;
  transition: all 0.2s ease;
}

.queue-action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: var(--soft-white);
}

.queue-play-btn {
  background: linear-gradient(135deg, var(--bantu-blue), var(--warm-gold));
  color: white;
}

.queue-play-btn:hover {
  transform: scale(1.05);
}

/* ============================================ */
/* EMPTY QUEUE STATE */
/* ============================================ */
.empty-queue {
  text-align: center;
  padding: 60px 20px;
  color: var(--slate-grey);
}

.empty-queue i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-queue p {
  font-size: 14px;
  margin-bottom: 20px;
}

.browse-content-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: linear-gradient(135deg, var(--bantu-blue), var(--warm-gold));
  border: none;
  border-radius: 40px;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.browse-content-btn:hover {
  transform: translateY(-2px);
  gap: 12px;
}

/* ============================================ */
/* QUEUE CONTEXT MENU */
/* ============================================ */
.queue-context-menu {
  position: fixed;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 8px 0;
  min-width: 200px;
  z-index: 1000;
  backdrop-filter: blur(20px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: menuFadeIn 0.2s ease;
}

@keyframes menuFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.queue-context-menu .menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  color: var(--soft-white);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease;
  text-align: left;
}

.queue-context-menu .menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.queue-context-menu .menu-item i {
  width: 18px;
  font-size: 12px;
  color: var(--slate-grey);
}

.queue-context-menu hr {
  margin: 4px 0;
  border-color: var(--card-border);
}

/* ============================================ */
/* PLAYLIST QUEUE WITH VIDEO ACTIVE */
/* ============================================ */
.content-hero.video-active .playlist-queue-section {
  margin-top: 20px;
}

/* ============================================ */
/* NOW PLAYING BAR (Mobile) */
/* ============================================ */
.now-playing-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  border-top: 1px solid var(--card-border);
  padding: 10px 16px;
  display: none;
  align-items: center;
  gap: 12px;
  z-index: 100;
  transform: translateY(100%);
  transition: transform 0.3s ease;
}

.now-playing-bar.visible {
  transform: translateY(0);
}

.now-playing-thumb {
  width: 48px;
  height: 27px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.now-playing-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.now-playing-info {
  flex: 1;
  min-width: 0;
}

.now-playing-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--soft-white);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.now-playing-artist {
  font-size: 11px;
  color: var(--slate-grey);
}

.now-playing-controls {
  display: flex;
  gap: 16px;
}

.now-playing-btn {
  background: none;
  border: none;
  color: var(--soft-white);
  cursor: pointer;
  padding: 8px;
  transition: all 0.2s ease;
}

.now-playing-btn:hover {
  color: var(--bantu-blue);
  transform: scale(1.1);
}

/* ============================================ */
/* RESPONSIVE ADJUSTMENTS */
/* ============================================ */
@media (max-width: 768px) {
  .playlist-queue-header {
    padding: 12px 16px;
  }
  
  .playlist-queue-header h2 {
    font-size: 16px;
  }
  
  .playlist-meta-info {
    font-size: 11px;
  }
  
  .playlist-queue-item {
    padding: 10px 12px;
  }
  
  .queue-thumbnail {
    width: 50px;
    height: 28px;
  }
  
  .track-number {
    min-width: 28px;
    font-size: 12px;
  }
  
  .queue-title {
    font-size: 13px;
  }
  
  .queue-artist {
    font-size: 10px;
  }
  
  .queue-duration {
    font-size: 11px;
    min-width: 40px;
  }
  
  .queue-actions {
    opacity: 1;
  }
}

@media (max-width: 550px) {
  .playlist-queue-section {
    border-radius: 12px;
  }
  
  .playlist-queue-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .playlist-meta-info {
    order: 2;
  }
  
  .playlist-actions {
    order: 1;
    align-self: flex-end;
  }
  
  .playlist-queue-list {
    max-height: 400px;
  }
  
  .playlist-queue-item {
    gap: 8px;
  }
  
  .queue-thumbnail {
    width: 45px;
    height: 25px;
  }
  
  .track-number {
    min-width: 24px;
    font-size: 11px;
  }
  
  .queue-title {
    font-size: 12px;
  }
  
  .queue-artist {
    font-size: 9px;
  }
  
  .queue-duration {
    display: none;
  }
  
  .queue-action-btn {
    padding: 3px 6px;
  }
  
  /* Show now playing bar on mobile when playing */
  .now-playing-bar {
    display: flex;
  }
  
  .playlist-queue-section {
    margin-bottom: 70px;
  }
}

@media (max-width: 400px) {
  .queue-thumbnail {
    display: none;
  }
  
  .track-number {
    min-width: 20px;
  }
  
  .queue-title {
    font-size: 11px;
  }
  
  .playlist-action-btn span {
    display: none;
  }
  
  .playlist-action-btn {
    padding: 6px 10px;
  }
  
  .playlist-action-btn i {
    margin: 0;
  }
}

/* ============================================ */
/* ANIMATIONS */
/* ============================================ */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.playlist-queue-item {
  animation: slideIn 0.3s ease backwards;
}

.playlist-queue-item:nth-child(1) { animation-delay: 0.05s; }
.playlist-queue-item:nth-child(2) { animation-delay: 0.1s; }
.playlist-queue-item:nth-child(3) { animation-delay: 0.15s; }
.playlist-queue-item:nth-child(4) { animation-delay: 0.2s; }
.playlist-queue-item:nth-child(5) { animation-delay: 0.25s; }
.playlist-queue-item:nth-child(6) { animation-delay: 0.3s; }

@keyframes slideOut {
  to {
    opacity: 0;
    transform: translateX(-20px);
  }
}

.playlist-queue-item.removing {
  animation: slideOut 0.2s ease forwards;
}

/* ============================================ */
/* THEME SUPPORT */
/* ============================================ */
.theme-light .playlist-queue-section {
  background: rgba(255, 255, 255, 0.8);
}

.theme-light .playlist-queue-header h2 {
  color: var(--deep-navy);
}

.theme-light .queue-title {
  color: var(--deep-navy);
}

.theme-light .playlist-queue-item.active .queue-title {
  color: var(--bantu-blue);
}

.theme-light .queue-context-menu {
  background: white;
}

/* High contrast mode */
.theme-high-contrast .playlist-queue-section {
  border: 2px solid white;
  background: black;
}

.theme-high-contrast .playlist-queue-item.active {
  background: #00FF00;
  color: black;
}

.theme-high-contrast .playlist-queue-item.active .queue-title {
  color: black;
}

.theme-high-contrast .queue-context-menu {
  border: 2px solid white;
  background: black;
}

.theme-high-contrast .queue-context-menu .menu-item:hover {
  background: white;
  color: black;
}

/* ============================================ */
/* END OF PLAYLIST QUEUE MODULE */
/* ============================================ */
