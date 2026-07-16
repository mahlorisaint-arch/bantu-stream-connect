(function() {
  'use strict';

  // ===== SUPABASE CONFIGURATION =====
  const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ===== GLOBAL STATE =====
  window.currentUser = null;
  window.userProfile = null;
  window.sonicDNA = null;
  window.portalDrop = null;
  window.worlds = [];
  window.worldProgress = {};
  window.currentWorldView = 'grid'; // 'grid' or 'detail'
  window.currentWorldId = null;
  window.worldBreadcrumb = [];

  // ===== CONTENT FORMAT CONSTANTS =====
  const MUSIC_FORMATS = ['album_track', 'music', 'music_video', 'song', 'track', 'audio'];

  // ===== ARCHETYPE DEFINITIONS =====
  const ARCHETYPES = {
    'Sound Nomad': {
      desc: 'You chase sounds that move after dark.',
      color: '#34E7FF'
    },
    'Night Voyager': {
      desc: 'You chase sounds that move after dark.',
      color: '#8B5CF6'
    },
    'Heat Chaser': {
      desc: 'You live for the peak, the drop, the moment.',
      color: '#EF4444'
    },
    'Soul Carrier': {
      desc: 'You carry the old sounds forward.',
      color: '#10B981'
    },
    'Underground Pulse': {
      desc: 'You dig deeper than the surface.',
      color: '#EC4899'
    },
    'Root Seeker': {
      desc: 'You find your home in one sound.',
      color: '#F59E0B'
    },
    'Golden Root': {
      desc: 'You honor the classics.',
      color: '#F97316'
    },
    'Border Blur': {
      desc: 'You move between worlds.',
      color: '#06B6D4'
    }
  };

  // ===== HELPER FUNCTIONS =====
  function showToast(message, type = 'info') {
    if (window.showToast) return window.showToast(message, type);
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { error: 'fa-exclamation-triangle', success: 'fa-check-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return (num || 0).toString();
  }

  function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatTimeAgo(dateString) {
    if (!dateString) return 'Just now';
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  function fixMediaUrl(url) {
    if (!url) return 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    if (url.startsWith('http')) return url;
    return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  // ===== AUTH =====
  async function checkAuth() {
    try {
      const { data } = await supabase.auth.getSession();
      window.currentUser = data?.session?.user || null;
      if (window.currentUser) {
        await loadUserProfile();
      }
      return window.currentUser;
    } catch (e) {
      console.error('Auth error:', e);
      return null;
    }
  }

  async function loadUserProfile() {
    if (!window.currentUser) return;
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', window.currentUser.id)
        .maybeSingle();
      window.userProfile = profile;
      window.sonicDNA = profile?.sonic_dna || null;
    } catch (e) {
      console.warn('Profile load error:', e);
    }
  }

  // ===== SONIC DNA QUIZ (FIX #2) =====
  const SonicQuiz = {
    currentStep: 0,
    totalSteps: 6,
    selections: [],
    quizGenres: [],

    async init() {
      // Load quiz genres from database
      const { data } = await supabase
        .from('genres')
        .select('*')
        .eq('is_featured_in_onboarding', true)
        .is('parent_genre_id', null)
        .order('onboarding_sort_order', { ascending: true })
        .limit(8);

      if (data && data.length >= 6) {
        this.quizGenres = data.slice(0, 6);
      } else {
        // Fallback genres
        this.quizGenres = [
          { id: '1', name: 'Amapiano', description: 'Log drums, deep house, Pretoria nights' },
          { id: '2', name: 'Afrobeat', description: 'West African grooves, Fela Kuti legacy' },
          { id: '3', name: 'Highlife', description: 'Ghanaian guitar, palm wine melodies' },
          { id: '4', name: 'Hip-Hop', description: 'Beats, bars, and culture' },
          { id: '5', name: 'Soul', description: 'Smooth vocals, timeless emotion' },
          { id: '6', name: 'Gospel', description: 'Spiritual, uplifting, powerful' }
        ];
      }
    },

    open() {
      const modal = document.getElementById('sonic-quiz-modal');
      if (!modal) return;
      modal.classList.add('active');
      this.reset();
      this.showStep('intro');
    },

    close() {
      const modal = document.getElementById('sonic-quiz-modal');
      if (modal) modal.classList.remove('active');
    },

    reset() {
      this.currentStep = 0;
      this.selections = [];
    },

    showStep(step) {
      document.querySelectorAll('.sonic-quiz-step').forEach(el => {
        el.style.display = el.dataset.step === step ? 'block' : 'none';
      });

      if (step === 'quiz') {
        this.renderQuizCard();
      } else if (step === 'reveal') {
        this.renderReveal();
      }
    },

    renderQuizCard() {
      const container = document.getElementById('sonic-quiz-card-container');
      const dotsContainer = document.getElementById('sonic-quiz-dots');
      const progressFill = document.getElementById('sonic-quiz-progress-fill');

      if (!container) return;

      const genre = this.quizGenres[this.currentStep];
      if (!genre) {
        this.showStep('reveal');
        return;
      }

      // Render dots
      dotsContainer.innerHTML = this.quizGenres.map((_, idx) => {
        let className = 'sonic-quiz-dot';
        if (idx < this.currentStep) className += ' done';
        if (idx === this.currentStep) className += ' active';
        return `<div class="${className}"></div>`;
      }).join('');

      // Update progress bar
      progressFill.style.width = `${((this.currentStep + 1) / this.totalSteps) * 100}%`;

      // Render card
      const colors = ['#1D4ED8', '#F59E0B', '#EC4899', '#10B981', '#8B5CF6', '#EF4444'];
      const color = genre.onboarding_card_color || colors[this.currentStep % colors.length];

      container.innerHTML = `
        <div class="sonic-quiz-card" style="background: linear-gradient(135deg, ${color}40, ${color}80);">
          <div class="sonic-quiz-card-overlay"></div>
          <div class="sonic-quiz-card-content">
            <h3 class="sonic-quiz-card-name">${escapeHtml(genre.name)}</h3>
            <p class="sonic-quiz-card-desc">${escapeHtml(genre.description || 'Explore this sound')}</p>
          </div>
          <div class="sonic-quiz-card-cta">
            <i class="fas fa-heart"></i>
            <span>Into it</span>
          </div>
        </div>
      `;

      // Attach click handler
      container.querySelector('.sonic-quiz-card').addEventListener('click', () => {
        this.selectGenre(genre.id, genre.name);
      });
    },

    selectGenre(genreId, genreName) {
      this.selections.push({ id: genreId, name: genreName });
      this.currentStep++;

      if (this.currentStep >= this.totalSteps) {
        this.showStep('reveal');
      } else {
        this.renderQuizCard();
      }
    },

    skipCard() {
      this.currentStep++;
      if (this.currentStep >= this.totalSteps) {
        this.showStep('reveal');
      } else {
        this.renderQuizCard();
      }
    },

    async renderReveal() {
      // Calculate archetype based on selections
      const archetype = this.calculateArchetype();
      const archetypeData = ARCHETYPES[archetype] || ARCHETYPES['Border Blur'];

      // Update UI
      document.getElementById('sonic-quiz-archetype-name').textContent = archetype;
      document.getElementById('sonic-quiz-archetype-desc').textContent = archetypeData.desc;

      // Render breakdown
      const breakdown = document.getElementById('sonic-quiz-breakdown');
      const topGenres = this.selections.slice(0, 4);
      breakdown.innerHTML = topGenres.map((g, idx) => {
        const weight = Math.max(0.3, 0.9 - (idx * 0.15));
        return `
          <div class="sonic-quiz-breakdown-item">
            <span class="sonic-quiz-breakdown-label">${escapeHtml(g.name)}</span>
            <div class="sonic-quiz-breakdown-bar">
              <div class="sonic-quiz-breakdown-fill" style="width: ${weight * 100}%;"></div>
            </div>
            <span class="sonic-quiz-breakdown-value">${Math.round(weight * 100)}%</span>
          </div>
        `;
      }).join('');

      // Save to database
      await this.saveSonicDNA(archetype, topGenres);
    },

    calculateArchetype() {
      if (this.selections.length === 0) return 'Border Blur';

      const topGenre = this.selections[0]?.name || '';

      if (['Amapiano', 'Gqom'].includes(topGenre)) return 'Night Voyager';
      if (['Afrobeat', 'Afrofusion'].includes(topGenre)) return 'Heat Chaser';
      if (['Soul', 'Gospel'].includes(topGenre)) return 'Soul Carrier';
      if (topGenre === 'Highlife') return 'Golden Root';
      if (topGenre === 'Hip-Hop') return 'Underground Pulse';

      return 'Sound Nomad';
    },

    async saveSonicDNA(archetype, topGenres) {
      if (!window.currentUser) return;

      const sonicDNA = {
        archetype: archetype,
        top_genres: topGenres.map((g, idx) => ({
          id: g.id,
          name: g.name,
          weight: Math.max(0.3, 0.9 - (idx * 0.15))
        })),
        mood_weights: {
          nocturnal: archetype === 'Night Voyager' ? 0.8 : 0.3,
          energetic: archetype === 'Heat Chaser' ? 0.8 : 0.3,
          spiritual: archetype === 'Soul Carrier' ? 0.8 : 0.3
        },
        discovery_tolerance: archetype === 'Sound Nomad' ? 0.8 : 0.4,
        last_updated: new Date().toISOString()
      };

      try {
        await supabase
          .from('user_profiles')
          .update({
            sonic_dna: sonicDNA,
            top_genre_id: topGenres[0]?.id || null
          })
          .eq('id', window.currentUser.id);

        window.sonicDNA = sonicDNA;
        showToast('Your Sonic DNA has been revealed!', 'success');
      } catch (e) {
        console.error('Error saving Sonic DNA:', e);
        showToast('Could not save your Sonic DNA', 'error');
      }
    }
  };

  // ===== SONIC DNA RENDERING =====
  function renderSonicDNA() {
    const archetypeEl = document.getElementById('sonic-dna-archetype');
    const subtitleEl = document.getElementById('sonic-dna-subtitle');
    const barsEl = document.getElementById('sonic-dna-bars');
    const ctaEl = document.getElementById('sonic-dna-cta');
    const ctaTextEl = document.getElementById('sonic-dna-cta-text');
    const sectionEl = document.getElementById('sonic-dna-section');

    if (!window.sonicDNA || !window.sonicDNA.archetype) {
      // No DNA yet - show quiz CTA
      archetypeEl.textContent = 'Discover your sound';
      subtitleEl.textContent = 'Take the 30-second taste quiz';
      barsEl.innerHTML = '';
      ctaTextEl.textContent = 'Take the 30-second quiz';
      ctaEl.style.display = 'flex';

      // Hide section click (only CTA button works)
      sectionEl.style.cursor = 'default';
      return;
    }

    const dna = window.sonicDNA;
    archetypeEl.textContent = dna.archetype || 'Sound Explorer';
    subtitleEl.textContent = 'Your living taste profile';
    ctaTextEl.textContent = 'Retake quiz';
    ctaEl.style.display = 'flex';

    // Render top genre bars
    const topGenres = dna.top_genres || [];
    if (topGenres.length > 0) {
      barsEl.innerHTML = topGenres.slice(0, 4).map(g => `
        <div class="dna-bar-item">
          <span class="dna-bar-label">${escapeHtml(g.name || 'Unknown')}</span>
          <div class="dna-bar-track">
            <div class="dna-bar-fill" style="width: 0%;" data-target="${Math.round((g.weight || 0) * 100)}"></div>
          </div>
          <span class="dna-bar-value">${Math.round((g.weight || 0) * 100)}%</span>
        </div>
      `).join('');

      // Animate bars in
      setTimeout(() => {
        barsEl.querySelectorAll('.dna-bar-fill').forEach(fill => {
          fill.style.width = fill.dataset.target + '%';
        });
      }, 100);
    } else {
      barsEl.innerHTML = '<p style="color: var(--slate-grey); font-size: 12px;">Listen to more to build your DNA</p>';
    }
  }

  // ===== CONTINUE LISTENING =====
  async function loadContinueListening() {
    const row = document.getElementById('continue-listening-row');
    const section = document.getElementById('continue-listening-section');

    if (!window.currentUser) {
      section.style.display = 'none';
      return;
    }

    try {
      const { data, error } = await supabase
        .from('watch_progress')
        .select(`
          content_id,
          last_position,
          total_watch_time,
          is_completed,
          Content!inner (
            id,
            title,
            thumbnail_url,
            duration,
            content_format,
            user_profiles!user_id (full_name, username)
          )
        `)
        .eq('user_id', window.currentUser.id)
        .eq('is_completed', false)
        .in('Content.content_format', MUSIC_FORMATS)
        .order('updated_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      if (!data || data.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';
      row.innerHTML = data.map(item => {
        const content = item.Content;
        const progress = content.duration ? Math.min(100, Math.round((item.last_position / content.duration) * 100)) : 0;
        const creator = content.user_profiles?.full_name || content.user_profiles?.username || 'Artist';
        const meta = formatMeta(content.content_format);

        return `
          <div class="continue-card" data-content-id="${content.id}">
            <div class="continue-card-artwork">
              <img src="${fixMediaUrl(content.thumbnail_url)}" alt="${escapeHtml(content.title)}" loading="lazy">
              <span class="continue-card-badge" style="background: ${meta.color};">${escapeHtml(meta.label)}</span>
              ${content.duration ? `<span class="continue-card-duration">${formatDuration(content.duration)}</span>` : ''}
              <div class="continue-card-progress">
                <div class="continue-card-progress-fill" style="width: ${progress}%;"></div>
              </div>
              <div class="continue-card-play"><i class="fas fa-play"></i></div>
            </div>
            <p class="continue-card-title">${escapeHtml(content.title)}</p>
            <p class="continue-card-meta">
              <i class="fas fa-user"></i>
              ${escapeHtml(creator)}
            </p>
          </div>
        `;
      }).join('');

      // Attach click handlers
      row.querySelectorAll('.continue-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.contentId;
          if (id) window.location.href = `../content-detail.html?id=${id}`;
        });
      });
    } catch (e) {
      console.error('Continue listening error:', e);
      section.style.display = 'none';
    }
  }

  function formatMeta(contentFormat) {
    const meta = {
      film: { label: 'Film', color: '#EF4444' },
      documentary: { label: 'Documentary', color: '#8B5CF6' },
      album_track: { label: 'Music', color: '#F59E0B' },
      music: { label: 'Music', color: '#F59E0B' },
      music_video: { label: 'Music video', color: '#F59E0B' },
      song: { label: 'Music', color: '#F59E0B' },
      track: { label: 'Music', color: '#F59E0B' },
      audio: { label: 'Audio', color: '#94A3B8' }
    };
    return meta[contentFormat] || { label: 'Content', color: '#1D4ED8' };
  }

  // ===== MYSTERY PORTAL (FIX #4) =====
  async function loadPortalDrop() {
    const noteEl = document.getElementById('portal-card-note');
    const countdownEl = document.getElementById('portal-countdown');
    const portalCard = document.getElementById('portal-card');

    if (!window.currentUser) {
      noteEl.textContent = 'Sign in to receive your daily drop';
      return;
    }

    try {
      // Call the portal drop function
      const { data, error } = await supabase
        .rpc('fn_generate_portal_drop', { p_user_id: window.currentUser.id });

      if (error) throw error;

      if (!data || data.length === 0) {
        noteEl.textContent = 'More mysteries coming soon...';
        return;
      }

      const drop = data[0];
      window.portalDrop = drop;

      // Load the actual content details
      const { data: contentData } = await supabase
        .from('Content')
        .select(`
          id,
          title,
          thumbnail_url,
          content_format,
          user_profiles!user_id (full_name, username)
        `)
        .eq('id', drop.content_id)
        .single();

      if (contentData) {
        noteEl.textContent = drop.curator_note || 'A sound chosen for you';
        setupPortalReveal(contentData, drop);
      }

      // Start countdown to next drop
      startPortalCountdown(countdownEl);
    } catch (e) {
      console.error('Portal drop error:', e);
      noteEl.textContent = 'Your portal is charging...';
    }
  }

  function setupPortalReveal(content, drop) {
    const portalCard = document.getElementById('portal-card');
    const modal = document.getElementById('portal-reveal-modal');
    const closeBtn = document.getElementById('portal-reveal-close');
    const playBtn = document.getElementById('portal-reveal-play-btn');

    // FIX #4: Ensure click handler is attached
    portalCard.onclick = () => {
      // Populate modal
      document.getElementById('portal-reveal-artwork').innerHTML = `
        <img src="${fixMediaUrl(content.thumbnail_url)}" alt="${escapeHtml(content.title)}">
        <div class="portal-reveal-artwork-blur"></div>
      `;
      document.getElementById('portal-reveal-title').textContent = content.title;
      document.getElementById('portal-reveal-artist').textContent =
        content.user_profiles?.full_name || content.user_profiles?.username || 'Unknown Artist';
      document.getElementById('portal-reveal-note').textContent = drop.curator_note || 'A sound chosen for you.';

      const dnaMatch = window.sonicDNA?.top_genres?.[0];
      document.getElementById('portal-reveal-dna-match').innerHTML = dnaMatch
        ? `<i class="fas fa-fingerprint"></i> Matched to your ${window.sonicDNA.archetype} DNA · ${Math.round(dnaMatch.weight * 100)}% ${dnaMatch.name}`
        : `<i class="fas fa-sparkles"></i> Fresh discovery just for you`;

      modal.classList.add('active');
      setTimeout(() => modal.classList.add('revealed'), 300);
    };

    closeBtn.onclick = () => {
      modal.classList.remove('active', 'revealed');
    };

    playBtn.onclick = () => {
      window.location.href = `../content-detail.html?id=${content.id}`;
    };

    // Close on overlay click
    modal.onclick = (e) => {
      if (e.target === modal || e.target.classList.contains('portal-reveal-overlay')) {
        modal.classList.remove('active', 'revealed');
      }
    };
  }

  function startPortalCountdown(el) {
    function update() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow - now;
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      el.textContent = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    update();
    setInterval(update, 1000);
  }

  // ===== PORTAL PARTICLES =====
  function createPortalParticles() {
    const container = document.getElementById('portal-card-particles');
    if (!container) return;
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('div');
      particle.className = 'portal-particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 6 + 's';
      particle.style.animationDuration = (4 + Math.random() * 4) + 's';
      container.appendChild(particle);
    }
  }

  // ===== WORLDS (FIX #3: In-page exploration) =====
  async function loadWorlds() {
    const grid = document.getElementById('worlds-grid');

    try {
      // Load top-level worlds (parent_genre_id IS NULL)
      const { data: worldsData, error: worldsError } = await supabase
        .from('genres')
        .select(`
          id,
          name,
          slug,
          description,
          metadata,
          unlock_threshold_tracks
        `)
        .is('parent_genre_id', null)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(10);

      if (worldsError) throw worldsError;
      if (!worldsData || worldsData.length === 0) {
        grid.innerHTML = '<div class="music-empty-state"><i class="fas fa-globe"></i><h4>No worlds yet</h4><p>Worlds are being curated</p></div>';
        return;
      }

      window.worlds = worldsData;

      // Load user's progress in these worlds
      if (window.currentUser) {
        const { data: progressData } = await supabase
          .from('user_world_progress')
          .select('genre_id, exploration_percentage, tracks_listened, unlocked_subworlds')
          .eq('user_id', window.currentUser.id);

        (progressData || []).forEach(p => {
          window.worldProgress[p.genre_id] = p;
        });
      }

      renderWorlds();
    } catch (e) {
      console.error('Worlds load error:', e);
      grid.innerHTML = '<div class="music-empty-state"><i class="fas fa-globe"></i><h4>Could not load worlds</h4></div>';
    }
  }

  function renderWorlds() {
    const grid = document.getElementById('worlds-grid');
    const worldColors = ['#1D4ED8', '#F59E0B', '#EC4899', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316'];

    grid.innerHTML = window.worlds.map((world, idx) => {
      const progress = window.worldProgress[world.id];
      const pct = progress ? Math.round(progress.exploration_percentage || 0) : 0;
      const tracksListened = progress ? progress.tracks_listened : 0;
      const color = worldColors[idx % worldColors.length];
      const isLocked = pct === 0 && !progress;

      return `
        <div class="world-card" data-world-id="${world.id}" data-world-name="${escapeHtml(world.name)}">
          <div class="world-card-artwork" style="background: linear-gradient(135deg, ${color}40, ${color}80);"></div>
          <div class="world-card-overlay"></div>
          <div class="world-card-lock ${isLocked ? '' : 'unlocked'}">
            <i class="fas ${isLocked ? 'fa-lock' : 'fa-check'}"></i>
          </div>
          <div class="world-card-content">
            <h4 class="world-card-name">${escapeHtml(world.name)}</h4>
            <div class="world-card-progress">
              <div class="world-card-progress-bar">
                <div class="world-card-progress-fill" style="width: ${pct}%;"></div>
              </div>
              <span class="world-card-progress-text">${pct}%</span>
            </div>
            <p class="world-card-meta">${tracksListened} track${tracksListened === 1 ? '' : 's'} explored</p>
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers
    grid.querySelectorAll('.world-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.worldId;
        const name = card.dataset.worldName;
        openWorldDetail(id, name);
      });
    });
  }

  // FIX #3: Open world detail in-page (not separate page)
  async function openWorldDetail(worldId, worldName) {
    window.currentWorldId = worldId;
    window.currentWorldView = 'detail';
    window.worldBreadcrumb = [{ id: worldId, name: worldName }];

    // Hide grid, show detail view
    document.getElementById('worlds-view-grid').style.display = 'none';
    document.getElementById('worlds-view-detail').style.display = 'block';
    document.getElementById('worlds-back-btn').style.display = 'flex';
    document.getElementById('worlds-breadcrumb').style.display = 'flex';
    document.getElementById('worlds-section-title').textContent = worldName;

    // Update breadcrumb
    renderBreadcrumb();

    // Load world details
    await loadWorldDetails(worldId);
  }

  function renderBreadcrumb() {
    const breadcrumb = document.getElementById('worlds-breadcrumb');
    breadcrumb.innerHTML = window.worldBreadcrumb.map((item, idx) => {
      const isLast = idx === window.worldBreadcrumb.length - 1;
      return `
        <span class="breadcrumb-item ${isLast ? 'active' : ''}" data-level="${idx}">${escapeHtml(item.name)}</span>
        ${!isLast ? '<span class="breadcrumb-separator">/</span>' : ''}
      `;
    }).join('');

    // Attach click handlers
    breadcrumb.querySelectorAll('.breadcrumb-item:not(.active)').forEach(item => {
      item.addEventListener('click', () => {
        const level = parseInt(item.dataset.level);
        navigateToBreadcrumbLevel(level);
      });
    });
  }

  function navigateToBreadcrumbLevel(level) {
    if (level === 0) {
      // Back to worlds grid
      closeWorldDetail();
    } else {
      // Navigate to specific level (future: load sub-world)
      const target = window.worldBreadcrumb[level];
      if (target) {
        openWorldDetail(target.id, target.name);
      }
    }
  }

  async function loadWorldDetails(worldId) {
    try {
      // Load world info
      const { data: worldData } = await supabase
        .from('genres')
        .select('*')
        .eq('id', worldId)
        .single();

      if (worldData) {
        document.getElementById('world-detail-name').textContent = worldData.name;
        document.getElementById('world-detail-description').textContent = worldData.description || '';

        const progress = window.worldProgress[worldId];
        const pct = progress ? Math.round(progress.exploration_percentage || 0) : 0;
        document.getElementById('world-detail-progress-fill').style.width = `${pct}%`;
        document.getElementById('world-detail-progress-text').textContent = `${pct}%`;
      }

      // Load sub-worlds
      await loadSubWorlds(worldId);

      // Load tracks
      await loadWorldTracks(worldId);

    } catch (e) {
      console.error('World details error:', e);
    }
  }

  async function loadSubWorlds(parentWorldId) {
    const grid = document.getElementById('world-detail-subworlds');

    try {
      const { data: subWorlds } = await supabase
        .from('genres')
        .select('*')
        .eq('parent_genre_id', parentWorldId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!subWorlds || subWorlds.length === 0) {
        grid.innerHTML = '<p style="color: var(--slate-grey); font-size: 12px;">No sub-worlds yet</p>';
        return;
      }

      const subWorldColors = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'];

      grid.innerHTML = subWorlds.map((world, idx) => {
        const progress = window.worldProgress[world.id];
        const pct = progress ? Math.round(progress.exploration_percentage || 0) : 0;
        const tracksListened = progress ? progress.tracks_listened : 0;
        const color = subWorldColors[idx % subWorldColors.length];
        const threshold = world.unlock_threshold_tracks || 5;
        const isLocked = pct === 0 && !progress;

        return `
          <div class="world-card" data-world-id="${world.id}" data-world-name="${escapeHtml(world.name)}">
            <div class="world-card-artwork" style="background: linear-gradient(135deg, ${color}40, ${color}80);"></div>
            <div class="world-card-overlay"></div>
            <div class="world-card-lock ${isLocked ? '' : 'unlocked'}">
              <i class="fas ${isLocked ? 'fa-lock' : 'fa-check'}"></i>
            </div>
            <div class="world-card-content">
              <h4 class="world-card-name">${escapeHtml(world.name)}</h4>
              <div class="world-card-progress">
                <div class="world-card-progress-bar">
                  <div class="world-card-progress-fill" style="width: ${pct}%;"></div>
                </div>
                <span class="world-card-progress-text">${pct}%</span>
              </div>
              <p class="world-card-meta">${tracksListened}/${threshold} tracks</p>
            </div>
          </div>
        `;
      }).join('');

      // Attach click handlers
      grid.querySelectorAll('.world-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.worldId;
          const name = card.dataset.worldName;
          window.worldBreadcrumb.push({ id, name });
          renderBreadcrumb();
          loadWorldDetails(id);
        });
      });

    } catch (e) {
      console.error('Sub-worlds error:', e);
      grid.innerHTML = '<p style="color: var(--slate-grey); font-size: 12px;">Could not load sub-worlds</p>';
    }
  }

  async function loadWorldTracks(worldId) {
    const list = document.getElementById('world-track-list');

    try {
      const { data: tracks } = await supabase
        .from('Content')
        .select(`
          id,
          title,
          duration,
          content_format,
          user_profiles!user_id (full_name, username),
          content_engagement_stats (total_views)
        `)
        .eq('primary_genre_id', worldId)
        .eq('status', 'published')
        .in('content_format', MUSIC_FORMATS)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!tracks || tracks.length === 0) {
        list.innerHTML = '<p style="color: var(--slate-grey); font-size: 12px; padding: 20px; text-align: center;">No tracks in this world yet</p>';
        return;
      }

      list.innerHTML = tracks.map((track, idx) => {
        const creator = track.user_profiles?.full_name || track.user_profiles?.username || 'Unknown Artist';
        const views = track.content_engagement_stats?.total_views || 0;

        return `
          <div class="world-track-item" data-content-id="${track.id}">
            <span class="world-track-number">${idx + 1}</span>
            <div class="world-track-info">
              <p class="world-track-title">${escapeHtml(track.title)}</p>
              <p class="world-track-artist">${escapeHtml(creator)} · ${formatNumber(views)} views</p>
            </div>
            <span class="world-track-duration">${formatDuration(track.duration)}</span>
            <div class="world-track-play">
              <i class="fas fa-play"></i>
            </div>
          </div>
        `;
      }).join('');

      // Attach click handlers
      list.querySelectorAll('.world-track-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.contentId;
          if (id) window.location.href = `../content-detail.html?id=${id}`;
        });
      });

    } catch (e) {
      console.error('Tracks error:', e);
      list.innerHTML = '<p style="color: var(--slate-grey); font-size: 12px; padding: 20px; text-align: center;">Could not load tracks</p>';
    }
  }

  function closeWorldDetail() {
    window.currentWorldView = 'grid';
    window.currentWorldId = null;
    window.worldBreadcrumb = [];

    document.getElementById('worlds-view-grid').style.display = 'block';
    document.getElementById('worlds-view-detail').style.display = 'none';
    document.getElementById('worlds-back-btn').style.display = 'none';
    document.getElementById('worlds-breadcrumb').style.display = 'none';
    document.getElementById('worlds-section-title').textContent = 'Worlds to explore';
  }

  // ===== SOCIAL STRIP =====
  async function loadSocialStrip() {
    const row = document.getElementById('social-strip-row');
    const section = document.getElementById('social-strip-section');

    try {
      const { data, error } = await supabase
        .from('watch_progress')
        .select(`
          user_id,
          updated_at,
          Content!inner (
            id,
            title,
            content_format,
            user_profiles!user_id (full_name, username, avatar_url)
          ),
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .in('Content.content_format', MUSIC_FORMATS)
        .neq('user_id', window.currentUser?.id || '00000000-0000-0000-0000-000000000000')
        .gte('updated_at', new Date(Date.now() - 3600000).toISOString())
        .order('updated_at', { ascending: false })
        .limit(8);

      if (error) throw error;

      if (!data || data.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';
      row.innerHTML = data.map(item => {
        const user = item.user_profiles;
        const content = item.Content;
        const name = user?.full_name || user?.username || 'Listener';
        const avatar = user?.avatar_url ? fixMediaUrl(user.avatar_url) : null;
        const trackTitle = content.title || 'a track';

        return `
          <div class="social-strip-item" data-content-id="${content.id}">
            <div class="social-strip-avatar">
              ${avatar ? `<img src="${avatar}" alt="${escapeHtml(name)}">` : getInitials(name)}
            </div>
            <div class="social-strip-info">
              <p class="social-strip-name">${escapeHtml(name)}</p>
              <p class="social-strip-track">Listening to ${escapeHtml(trackTitle)}</p>
            </div>
          </div>
        `;
      }).join('');

      row.querySelectorAll('.social-strip-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.contentId;
          if (id) window.location.href = `../content-detail.html?id=${id}`;
        });
      });
    } catch (e) {
      console.error('Social strip error:', e);
      section.style.display = 'none';
    }
  }

  // ===== TRENDING =====
  async function loadTrending() {
    const grid = document.getElementById('trending-grid');

    try {
      const topGenres = window.sonicDNA?.top_genres?.slice(0, 3).map(g => g.id) || [];

      let query = supabase
        .from('Content')
        .select(`
          id,
          title,
          thumbnail_url,
          duration,
          content_format,
          user_profiles!user_id (full_name, username),
          content_engagement_stats (total_views, total_likes)
        `)
        .in('content_format', MUSIC_FORMATS)
        .eq('status', 'published');

      if (topGenres.length > 0) {
        query = query.in('primary_genre_id', topGenres);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;

      if (!data || data.length === 0) {
        grid.innerHTML = '<div class="music-empty-state"><i class="fas fa-chart-line"></i><h4>No trending tracks yet</h4></div>';
        return;
      }

      grid.innerHTML = data.map((item, idx) => {
        const views = item.content_engagement_stats?.total_views || 0;
        const likes = item.content_engagement_stats?.total_likes || 0;
        const creator = item.user_profiles?.full_name || item.user_profiles?.username || 'Artist';
        const meta = formatMeta(item.content_format);

        return `
          <div class="trending-card" data-content-id="${item.id}">
            <div class="trending-card-artwork">
              <img src="${fixMediaUrl(item.thumbnail_url)}" alt="${escapeHtml(item.title)}" loading="lazy">
              <span class="trending-card-badge" style="background: ${meta.color};">${escapeHtml(meta.label)}</span>
              ${item.duration ? `<span class="trending-card-duration">${formatDuration(item.duration)}</span>` : ''}
              <div class="trending-card-rank">${idx + 1}</div>
              <div class="trending-card-play"><i class="fas fa-play"></i></div>
            </div>
            <p class="trending-card-title">${escapeHtml(item.title)}</p>
            <p class="trending-card-artist">${escapeHtml(creator)}</p>
            <div class="trending-card-stats">
              <span><i class="fas fa-eye"></i> ${formatNumber(views)}</span>
              <span><i class="fas fa-heart"></i> ${formatNumber(likes)}</span>
            </div>
          </div>
        `;
      }).join('');

      grid.querySelectorAll('.trending-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.contentId;
          if (id) window.location.href = `../content-detail.html?id=${id}`;
        });
      });
    } catch (e) {
      console.error('Trending error:', e);
      grid.innerHTML = '<div class="music-empty-state"><i class="fas fa-chart-line"></i><h4>Could not load trending</h4></div>';
    }
  }

  // ===== SETUP EVENT LISTENERS =====
  function setupEventListeners() {
    // Sonic DNA section click (FIX #2)
    const dnaSection = document.getElementById('sonic-dna-section');
    const dnaCta = document.getElementById('sonic-dna-cta');

    if (dnaCta) {
      dnaCta.addEventListener('click', (e) => {
        e.stopPropagation();
        SonicQuiz.open();
      });
    }

    // Quiz modal
    const quizClose = document.getElementById('sonic-quiz-close');
    const quizStart = document.getElementById('sonic-quiz-start');
    const quizSkip = document.getElementById('sonic-quiz-skip');
    const quizDone = document.getElementById('sonic-quiz-done');
    const quizOverlay = document.querySelector('.sonic-quiz-overlay');

    if (quizClose) quizClose.addEventListener('click', () => SonicQuiz.close());
    if (quizOverlay) quizOverlay.addEventListener('click', () => SonicQuiz.close());
    if (quizStart) quizStart.addEventListener('click', () => SonicQuiz.showStep('quiz'));
    if (quizSkip) quizSkip.addEventListener('click', () => SonicQuiz.skipCard());
    if (quizDone) quizDone.addEventListener('click', () => {
      SonicQuiz.close();
      renderSonicDNA();
      loadPortalDrop();
      loadTrending();
    });

    // Worlds back button (FIX #3)
    const worldsBackBtn = document.getElementById('worlds-back-btn');
    if (worldsBackBtn) {
      worldsBackBtn.addEventListener('click', closeWorldDetail);
    }
  }

  // ===== INITIALIZE =====
  async function initialize() {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');

    try {
      await checkAuth();

      // Initialize quiz
      await SonicQuiz.init();

      // Load all sections in parallel
      await Promise.all([
        loadContinueListening(),
        loadPortalDrop(),
        loadWorlds(),
        loadSocialStrip(),
        loadTrending()
      ]);

      // Render Sonic DNA
      renderSonicDNA();
      createPortalParticles();

      // Setup event listeners
      setupEventListeners();

      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';

      console.log('✅ Music discovery page initialized');
    } catch (e) {
      console.error('Initialization error:', e);
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }
  }

  // ===== AUTH STATE CHANGES =====
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      window.currentUser = session.user;
      loadUserProfile().then(() => {
        renderSonicDNA();
        loadContinueListening();
        loadPortalDrop();
        loadWorlds();
        loadSocialStrip();
      });
    } else if (event === 'SIGNED_OUT') {
      window.currentUser = null;
      window.userProfile = null;
      window.sonicDNA = null;
      location.reload();
    }
  });

  // ===== START =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
