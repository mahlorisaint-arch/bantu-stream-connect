class QueueManager {

  constructor() {

    this.queue = [];
    this.currentIndex = 0;
    this.autoplay = true;

  }

  initialize(items = []) {

    this.queue = items;

    this.attachControls();

    console.log(
      '🎬 Queue initialized',
      items.length
    );

  }

  attachControls() {

    const nextBtn =
      document.getElementById(
        'nextTrackBtn'
      );

    const prevBtn =
      document.getElementById(
        'previousTrackBtn'
      );

    if (nextBtn) {
      nextBtn.onclick = () => this.playNext();
    }

    if (prevBtn) {
      prevBtn.onclick = () => this.playPrevious();
    }

    const autoplayToggle =
      document.getElementById(
        'autoplayToggle'
      );

    if (autoplayToggle) {

      autoplayToggle.onclick = () => {

        this.autoplay =
          !this.autoplay;

        autoplayToggle.classList.toggle(
          'active',
          this.autoplay
        );

      };

    }

    const video =
      document.getElementById(
        'inlineVideoPlayer'
      );

    if (video) {

      video.addEventListener(
        'ended',
        () => {

          if (this.autoplay) {
            this.playNext();
          }

        }
      );

    }

  }

  playById(contentId) {

    const index =
      this.queue.findIndex(
        item => String(item.id) === String(contentId)
      );

    if (index === -1) return;

    this.currentIndex = index;

    this.loadCurrentItem();

  }

  playNext() {

    if (
      this.currentIndex >=
      this.queue.length - 1
    ) {
      return;
    }

    this.currentIndex++;

    this.loadCurrentItem();

  }

  playPrevious() {

    if (this.currentIndex <= 0) {
      return;
    }

    this.currentIndex--;

    this.loadCurrentItem();

  }

  loadCurrentItem() {

    const item =
      this.queue[this.currentIndex];

    if (!item) return;

    console.log(
      '▶️ Playing:',
      item.title
    );

    window.location.href =
      `content-detail.html?id=${item.id}`;

  }

}

window.QueueManager =
  new QueueManager();
