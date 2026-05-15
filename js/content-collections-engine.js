class ContentCollectionsEngine {

  constructor() {
    this.currentCollection = null;
    this.currentItems = [];
  }

  async initialize(content) {

    if (!content?.series_id) {
      return;
    }

    console.log(
      '🎵 Loading collection...',
      content.series_id
    );

    await this.loadCollection(content.series_id);
  }

  async loadCollection(seriesId) {

    try {

      const { data: playlist } = await window.supabase
        .from('creator_playlists')
        .select('*')
        .eq('id', seriesId)
        .single();

      if (!playlist) {
        return;
      }

      const { data: items } = await window.supabase
        .from('Content')
        .select('*')
        .eq('series_id', seriesId)
        .eq('status', 'published')
        .order('episode_number', {
          ascending: true
        });

      this.currentCollection = playlist;
      this.currentItems = items || [];

      this.renderCollection();

      window.QueueManager.initialize(
        this.currentItems
      );

    } catch (error) {

      console.error(
        '❌ Collection load failed',
        error
      );

    }
  }

  renderCollection() {

    const section = document.getElementById(
      'collectionPlaybackSection'
    );

    if (!section) return;

    section.classList.remove('hidden');

    document.getElementById(
      'collectionTitle'
    ).textContent =
      this.currentCollection.name || 'Collection';

    document.getElementById(
      'collectionType'
    ).textContent =
      this.currentCollection.playlist_type || 'playlist';

    document.getElementById(
      'collectionItemsCount'
    ).textContent =
      `${this.currentItems.length} items`;

    document.getElementById(
      'collectionBadge'
    ).textContent =
      (
        this.currentCollection.playlist_type ||
        'playlist'
      ).toUpperCase();

    this.renderQueue();
  }

  renderQueue() {

    const queue = document.getElementById(
      'playlistQueue'
    );

    if (!queue) return;

    queue.innerHTML =
      this.currentItems.map((item, index) => `
        <div
          class="queue-item"
          data-content-id="${item.id}"
        >

          <div class="queue-thumbnail">

            <img
              src="${item.thumbnail_url || ''}"
              alt="${item.title}"
            >

            <div class="queue-index">
              ${index + 1}
            </div>

          </div>

          <div class="queue-content">

            <div class="queue-title">
              ${item.title || 'Untitled'}
            </div>

            <div class="queue-meta">
              ${item.content_format || ''}
            </div>

          </div>

        </div>
      `).join('');

    this.attachQueueEvents();
  }

  attachQueueEvents() {

    document
      .querySelectorAll('.queue-item')
      .forEach(item => {

        item.addEventListener('click', () => {

          const contentId =
            item.dataset.contentId;

          window.QueueManager.playById(
            contentId
          );

        });

      });
  }

}

window.ContentCollectionsEngine =
  new ContentCollectionsEngine();
