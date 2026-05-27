/**
 * Upcoming Events Module
 * Displays scheduled events with countdown timers, reminder functionality,
 * and calendar integration.
 */

const UpcomingEvents = (function() {
    'use strict';
    
    // Private variables
    let eventsList = null;
    let noEvents = null;
    let section = null;
    let currentUser = null;
    let refreshInterval = null;
    let countdownIntervals = [];
    let userReminders = new Set();
    
    // Configuration
    const CACHE_KEY = 'feed_upcomingEvents';
    const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
    const MAX_EVENTS = 5;
    const REFRESH_INTERVAL = 60000; // 1 minute (for countdown updates)
    
    /**
     * Initialize Upcoming Events module
     */
    async function init() {
        console.log('📅 Upcoming Events Module initializing...');
        
        section = document.getElementById('upcoming-events-section');
        eventsList = document.getElementById('events-list');
        noEvents = document.getElementById('no-events');
        
        if (!section || !eventsList || !noEvents) {
            console.warn('Upcoming Events elements not found, creating fallback');
            createFallbackElements();
        }
        
        // Get current user
        await getCurrentUser();
        
        // Load user reminders from localStorage
        loadUserReminders();
        
        // Load content
        await loadEvents();
        
        // Setup view toggle
        setupViewToggle();
        
        // Start countdown refresh interval
        startCountdownRefresh();
        
        console.log('✅ Upcoming Events Module initialized');
    }
    
    /**
     * Create fallback elements if not present in DOM
     */
    function createFallbackElements() {
        if (!document.getElementById('upcoming-events-section')) {
            const newSection = document.createElement('section');
            newSection.id = 'upcoming-events-section';
            newSection.className = 'section events-section';
            newSection.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fas fa-calendar-alt" style="color: var(--warm-gold);"></i>
                        UPCOMING EVENTS
                        <span class="events-badge">
                            <i class="fas fa-calendar-week"></i> Live Events
                        </span>
                    </h2>
                    <div class="events-view-toggle" id="events-view-toggle">
                        <button class="view-toggle-btn active" data-view="list">
                            <i class="fas fa-list"></i> List
                        </button>
                        <button class="view-toggle-btn" data-view="calendar">
                            <i class="fas fa-calendar"></i> Calendar
                        </button>
                    </div>
                </div>
                <div id="events-list" class="events-grid"></div>
                <div id="no-events" class="empty-state" style="display: none;">
                    <div class="empty-icon">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <h3>No Upcoming Events</h3>
                    <p>Check back soon for scheduled events</p>
                    <button id="suggest-event-btn" class="suggest-btn">
                        <i class="fas fa-lightbulb"></i> Suggest an Event
                    </button>
                </div>
            `;
            
            const creatorSection = document.getElementById('creator-of-the-week-section');
            if (creatorSection && creatorSection.parentNode) {
                creatorSection.insertAdjacentElement('afterend', newSection);
            } else {
                const main = document.querySelector('main.container');
                if (main) main.appendChild(newSection);
            }
        }
        
        section = document.getElementById('upcoming-events-section');
        eventsList = document.getElementById('events-list');
        noEvents = document.getElementById('no-events');
    }
    
    /**
     * Get current user from Supabase
     */
    async function getCurrentUser() {
        try {
            if (!window.supabaseAuth) {
                currentUser = null;
                return;
            }
            
            const { data: { session } } = await window.supabaseAuth.auth.getSession();
            currentUser = session?.user || null;
            console.log('📅 Upcoming Events user:', currentUser ? currentUser.id : 'guest');
        } catch (err) {
            console.error('Error getting current user:', err);
            currentUser = null;
        }
    }
    
    /**
     * Load user reminders from localStorage
     */
    function loadUserReminders() {
        try {
            const saved = localStorage.getItem('event_reminders');
            if (saved) {
                userReminders = new Set(JSON.parse(saved));
            }
        } catch (e) {
            console.warn('Failed to load reminders:', e);
        }
    }
    
    /**
     * Save user reminders to localStorage
     */
    function saveUserReminders() {
        try {
            localStorage.setItem('event_reminders', JSON.stringify([...userReminders]));
        } catch (e) {
            console.warn('Failed to save reminders:', e);
        }
    }
    
    /**
     * Load events from data source
     */
    async function loadEvents() {
        console.log('📅 Loading Upcoming Events...');
        
        // Try cached data first
        const cachedData = loadFromCache();
        if (cachedData && cachedData.length > 0) {
            console.log('📦 Upcoming Events: Using cached data,', cachedData.length, 'items');
            renderEvents(cachedData);
            startCountdownTimers(cachedData);
            return;
        }
        
        // Show skeletons
        showSkeletons();
        
        try {
            let events = [];
            
            // Try to fetch from Supabase
            try {
                const result = await window.supabaseAuth
                    .from('events')
                    .select('*')
                    .gte('start_time', new Date().toISOString())
                    .order('start_time', { ascending: true })
                    .limit(MAX_EVENTS);
                
                events = result.data || [];
            } catch (e) {
                console.warn('Events table may not exist, using mock data');
                events = getMockEvents();
            }
            
            if (!events || events.length === 0) {
                showEmptyState();
                return;
            }
            
            // Enrich events with additional data
            const enrichedEvents = await enrichEvents(events);
            
            // Render
            renderEvents(enrichedEvents);
            
            // Cache the result
            saveToCache(enrichedEvents);
            
            // Start countdown timers
            startCountdownTimers(enrichedEvents);
            
            console.log('✅ Upcoming Events loaded:', enrichedEvents.length, 'events');
            
        } catch (err) {
            console.error("❌ Upcoming Events Error:", err);
            
            // Fallback to mock data
            const mockEvents = getMockEvents();
            if (mockEvents.length > 0) {
                renderEvents(mockEvents);
                startCountdownTimers(mockEvents);
            } else {
                showErrorState();
            }
        }
    }
    
    /**
     * Enrich events with additional data
     */
    async function enrichEvents(events) {
        return events.map(event => {
            const startTime = new Date(event.start_time || event.time);
            const now = new Date();
            const daysUntil = Math.ceil((startTime - now) / (1000 * 60 * 60 * 24));
            
            let urgency = 'normal';
            if (daysUntil <= 1) urgency = 'urgent';
            else if (daysUntil <= 3) urgency = 'soon';
            
            return {
                ...event,
                start_date: startTime,
                days_until: daysUntil,
                urgency: urgency,
                has_reminder: userReminders.has(event.id),
                formatted_date: formatEventDate(startTime),
                formatted_time: formatEventTime(startTime)
            };
        });
    }
    
    /**
     * Format event date
     */
    function formatEventDate(date) {
        return date.toLocaleDateString('en-ZA', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric'
        });
    }
    
    /**
     * Format event time
     */
    function formatEventTime(date) {
        return date.toLocaleTimeString('en-ZA', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    }
    
    /**
     * Get mock events for fallback
     */
    function getMockEvents() {
        const now = new Date();
        return [
            {
                id: 'event1',
                title: 'African Music Festival Live Stream',
                description: 'Join us for the biggest African music festival with live performances from top artists across the continent. Experience the rhythm of Africa from anywhere in the world!',
                time: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                start_time: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                location: 'Virtual Event',
                organizer: 'AfroBeats Entertainment',
                tags: ['Music', 'Live', 'Festival', 'African'],
                image_url: null
            },
            {
                id: 'event2',
                title: 'Tech Startup Pitch Competition',
                description: 'Watch innovative African startups pitch their ideas to a panel of investors. Network with founders and industry leaders.',
                time: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                start_time: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                location: 'Cape Town, South Africa',
                organizer: 'Africa Tech Summit',
                tags: ['Technology', 'Startups', 'Business', 'Networking'],
                image_url: null
            },
            {
                id: 'event3',
                title: 'Cooking Masterclass: Traditional Dishes',
                description: 'Learn to cook authentic African dishes with master chefs. Perfect for home cooks looking to expand their culinary skills.',
                time: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(),
                start_time: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(),
                location: 'Johannesburg, South Africa',
                organizer: 'African Culinary Institute',
                tags: ['Food', 'Cooking', 'Education', 'Cultural'],
                image_url: null
            },
            {
                id: 'event4',
                title: 'Digital Creator Summit 2025',
                description: 'Join top content creators from across Africa for workshops, networking, and insights on growing your digital presence.',
                time: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString(),
                start_time: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString(),
                location: 'Virtual + Lagos, Nigeria',
                organizer: 'Creator Economy Africa',
                tags: ['Content Creation', 'Workshop', 'Networking'],
                image_url: null
            }
        ];
    }
    
    /**
     * Render events list
     */
    function renderEvents(events) {
        if (!eventsList) return;
        
        eventsList.style.display = 'block';
        if (noEvents) noEvents.style.display = 'none';
        
        eventsList.innerHTML = events.map(event => {
            const eventDate = event.start_date || new Date(event.start_time || event.time);
            const day = eventDate.getDate();
            const month = eventDate.toLocaleString('default', { month: 'short' }).toUpperCase();
            const urgencyClass = event.urgency === 'urgent' ? 'urgent' : event.urgency === 'soon' ? 'soon' : '';
            const hasReminder = event.has_reminder || userReminders.has(event.id);
            
            // Generate countdown HTML placeholder (will be updated by timer)
            const countdownId = `countdown-${event.id}`;
            
            return `
                <div class="event-card" data-event-id="${event.id}" data-urgency="${urgencyClass}">
                    <div class="event-header">
                        <div class="event-title-section">
                            <div class="event-title">
                                <i class="fas fa-calendar-alt"></i>
                                ${escapeHtml(event.title)}
                            </div>
                            <div class="event-time">
                                <i class="fas fa-clock"></i>
                                ${formatEventTime(eventDate)} • ${formatEventDate(eventDate)}
                            </div>
                        </div>
                        <div class="event-date-badge">
                            <div class="event-date-day">${day}</div>
                            <div class="event-date-month">${month}</div>
                        </div>
                    </div>
                    
                    <div class="event-description">
                        ${escapeHtml(event.description || 'No description available')}
                    </div>
                    
                    <div class="event-meta">
                        ${event.location ? `
                            <div class="event-meta-item">
                                <i class="fas fa-map-marker-alt"></i> ${escapeHtml(event.location)}
                            </div>
                        ` : ''}
                        ${event.organizer ? `
                            <div class="event-meta-item">
                                <i class="fas fa-user-tie"></i> ${escapeHtml(event.organizer)}
                            </div>
                        ` : ''}
                        <div class="event-meta-item">
                            <i class="fas fa-calendar-week"></i> ${event.days_until <= 0 ? 'Today!' : `${event.days_until} days away`}
                        </div>
                    </div>
                    
                    ${event.tags && event.tags.length > 0 ? `
                        <div class="event-tags">
                            ${event.tags.map(tag => `<span class="event-tag">#${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                    
                    <div id="${countdownId}" class="event-countdown"></div>
                    
                    <div class="event-actions">
                        <button class="reminder-btn ${hasReminder ? 'reminder-set' : ''}" data-event-id="${event.id}">
                            <i class="fas ${hasReminder ? 'fa-bell-slash' : 'fa-bell'}"></i>
                            ${hasReminder ? 'Remove Reminder' : 'Set Reminder'}
                        </button>
                        <button class="details-btn" data-event-id="${event.id}">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                        <button class="share-event-btn" data-event-id="${event.id}" title="Share Event">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Attach event listeners
        attachEventListeners();
    }
    
    /**
     * Attach event listeners to action buttons
     */
    function attachEventListeners() {
        // Reminder buttons
        document.querySelectorAll('.reminder-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                await toggleReminder(eventId);
            });
        });
        
        // Details buttons
        document.querySelectorAll('.details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                showEventDetails(eventId);
            });
        });
        
        // Share buttons
        document.querySelectorAll('.share-event-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                shareEvent(eventId);
            });
        });
        
        // Event card click (for details)
        document.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on a button
                if (e.target.closest('button')) return;
                const eventId = card.dataset.eventId;
                showEventDetails(eventId);
            });
        });
    }
    
    /**
     * Toggle reminder for an event
     */
    async function toggleReminder(eventId) {
        if (!currentUser) {
            showToast('Please sign in to set reminders', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        const btn = document.querySelector(`.reminder-btn[data-event-id="${eventId}"]`);
        const isRemoved = userReminders.has(eventId);
        
        if (isRemoved) {
            userReminders.delete(eventId);
            btn.classList.remove('reminder-set');
            btn.innerHTML = '<i class="fas fa-bell"></i> Set Reminder';
            showToast('Reminder removed', 'info');
        } else {
            userReminders.add(eventId);
            btn.classList.add('reminder-set');
            btn.innerHTML = '<i class="fas fa-bell-slash"></i> Remove Reminder';
            showToast('Reminder set! We\'ll notify you before the event.', 'success');
            
            // Request notification permission if needed
            if (Notification.permission === 'granted') {
                scheduleNotification(eventId);
            } else if (Notification.permission !== 'denied') {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    scheduleNotification(eventId);
                }
            }
        }
        
        saveUserReminders();
        
        // Update the event in the list
        const event = await getEventById(eventId);
        if (event && !isRemoved) {
            scheduleEmailReminder(event);
        }
    }
    
    /**
     * Schedule browser notification
     */
    function scheduleNotification(eventId) {
        // Get event data and schedule notification
        const eventCard = document.querySelector(`.event-card[data-event-id="${eventId}"]`);
        if (!eventCard) return;
        
        const title = eventCard.querySelector('.event-title')?.textContent || 'Upcoming Event';
        const eventDate = new Date(eventCard.querySelector('.event-time')?.textContent || '');
        
        const timeUntil = eventDate - new Date();
        if (timeUntil > 0 && timeUntil < 24 * 60 * 60 * 1000) {
            setTimeout(() => {
                new Notification('📅 Event Reminder', {
                    body: `${title} starts in less than 24 hours!`,
                    icon: '/assets/icon/bantu_stream_connect_icon.png',
                    tag: `event-${eventId}`,
                    requireInteraction: true
                });
            }, Math.max(1000, timeUntil - 24 * 60 * 60 * 1000));
        }
    }
    
    /**
     * Get event by ID
     */
    async function getEventById(eventId) {
        try {
            const { data } = await window.supabaseAuth
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();
            return data;
        } catch (e) {
            // Check mock events
            const mockEvents = getMockEvents();
            return mockEvents.find(e => e.id === eventId);
        }
    }
    
    /**
     * Schedule email reminder (simulated)
     */
    function scheduleEmailReminder(event) {
        console.log(`📧 Email reminder scheduled for event: ${event.title}`);
        // In production, this would call an API endpoint
    }
    
    /**
     * Show event details modal
     */
    function showEventDetails(eventId) {
        const eventCard = document.querySelector(`.event-card[data-event-id="${eventId}"]`);
        if (!eventCard) return;
        
        const title = eventCard.querySelector('.event-title')?.textContent || '';
        const time = eventCard.querySelector('.event-time')?.textContent || '';
        const description = eventCard.querySelector('.event-description')?.textContent || '';
        const tags = Array.from(eventCard.querySelectorAll('.event-tag')).map(tag => tag.textContent);
        
        // Create modal
        const modalHtml = `
            <div id="event-detail-modal" class="modal-overlay">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-calendar-alt"></i> Event Details</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <h4 style="color: var(--warm-gold); margin-bottom: 8px;">${escapeHtml(title)}</h4>
                        <p style="color: var(--soft-white); margin-bottom: 12px;"><i class="fas fa-clock"></i> ${escapeHtml(time)}</p>
                        <p style="color: var(--slate-grey); margin-bottom: 16px;">${escapeHtml(description)}</p>
                        ${tags.length > 0 ? `
                            <div class="event-tags" style="margin-bottom: 16px;">
                                ${tags.map(tag => `<span class="event-tag">${escapeHtml(tag)}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div class="event-actions" style="justify-content: center;">
                            <button id="modal-reminder-btn" class="reminder-btn">
                                <i class="fas fa-bell"></i> Set Reminder
                            </button>
                            <button id="modal-share-btn" class="details-btn">
                                <i class="fas fa-share"></i> Share
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.getElementById('event-detail-modal');
        const closeBtn = modal.querySelector('.modal-close');
        
        const closeModal = () => modal.remove();
        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        const modalReminderBtn = document.getElementById('modal-reminder-btn');
        if (modalReminderBtn) {
            modalReminderBtn.addEventListener('click', () => {
                toggleReminder(eventId);
                closeModal();
            });
        }
        
        const modalShareBtn = document.getElementById('modal-share-btn');
        if (modalShareBtn) {
            modalShareBtn.addEventListener('click', () => {
                shareEvent(eventId);
                closeModal();
            });
        }
    }
    
    /**
     * Share event
     */
    function shareEvent(eventId) {
        const eventUrl = `${window.location.origin}/event.html?id=${eventId}`;
        navigator.clipboard.writeText(eventUrl).then(() => {
            showToast('Event link copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Share URL: ' + eventUrl, 'info');
        });
    }
    
    /**
     * Start countdown timers for all events
     */
    function startCountdownTimers(events) {
        // Clear existing intervals
        countdownIntervals.forEach(interval => clearInterval(interval));
        countdownIntervals = [];
        
        events.forEach(event => {
            const countdownId = `countdown-${event.id}`;
            const countdownElement = document.getElementById(countdownId);
            if (!countdownElement) return;
            
            const updateCountdown = () => {
                const eventDate = event.start_date || new Date(event.start_time || event.time);
                const now = new Date();
                const diff = eventDate - now;
                
                if (diff <= 0) {
                    countdownElement.innerHTML = `
                        <div class="countdown-item">
                            <span class="countdown-value">Event Started!</span>
                        </div>
                    `;
                    return;
                }
                
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                
                if (days > 0) {
                    countdownElement.innerHTML = `
                        <div class="countdown-item">
                            <span class="countdown-value">${days}d</span>
                            <span class="countdown-label">Days</span>
                        </div>
                        <div class="countdown-item">
                            <span class="countdown-value">${hours}h</span>
                            <span class="countdown-label">Hours</span>
                        </div>
                        <div class="countdown-item">
                            <span class="countdown-value">${minutes}m</span>
                            <span class="countdown-label">Mins</span>
                        </div>
                    `;
                } else {
                    countdownElement.innerHTML = `
                        <div class="countdown-item">
                            <span class="countdown-value">${hours.toString().padStart(2, '0')}</span>
                            <span class="countdown-label">Hours</span>
                        </div>
                        <div class="countdown-item">
                            <span class="countdown-value">${minutes.toString().padStart(2, '0')}</span>
                            <span class="countdown-label">Mins</span>
                        </div>
                        <div class="countdown-item">
                            <span class="countdown-value">${seconds.toString().padStart(2, '0')}</span>
                            <span class="countdown-label">Secs</span>
                        </div>
                    `;
                }
            };
            
            updateCountdown();
            const interval = setInterval(updateCountdown, 1000);
            countdownIntervals.push(interval);
        });
    }
    
    /**
     * Start countdown refresh interval
     */
    function startCountdownRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            // Refresh events to update countdowns
            const cachedData = loadFromCache();
            if (cachedData && cachedData.length > 0) {
                startCountdownTimers(cachedData);
            }
        }, REFRESH_INTERVAL);
    }
    
    /**
     * Setup view toggle (list/calendar)
     */
    function setupViewToggle() {
        const toggleContainer = document.getElementById('events-view-toggle');
        if (!toggleContainer) return;
        
        toggleContainer.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                toggleContainer.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (view === 'calendar') {
                    showCalendarView();
                } else {
                    showListView();
                }
            });
        });
    }
    
    /**
     * Show calendar view (simplified)
     */
    function showCalendarView() {
        showToast('Calendar view coming soon!', 'info');
    }
    
    /**
     * Show list view
     */
    function showListView() {
        // Already in list view, just refresh
        loadEvents();
    }
    
    /**
     * Show skeleton loading state
     */
    function showSkeletons() {
        if (!eventsList) return;
        
        eventsList.style.display = 'block';
        if (noEvents) noEvents.style.display = 'none';
        
        eventsList.innerHTML = Array(3).fill().map(() => `
            <div class="event-skeleton">
                <div class="event-skeleton-header">
                    <div class="event-skeleton-title"></div>
                    <div class="event-skeleton-date"></div>
                </div>
                <div class="event-skeleton-line"></div>
                <div class="event-skeleton-line short"></div>
                <div class="event-skeleton-line"></div>
            </div>
        `).join('');
    }
    
    /**
     * Show empty state
     */
    function showEmptyState() {
        if (eventsList) eventsList.style.display = 'none';
        if (noEvents) noEvents.style.display = 'block';
        
        const suggestBtn = document.getElementById('suggest-event-btn');
        if (suggestBtn) {
            suggestBtn.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/suggest-event';
            });
        }
    }
    
    /**
     * Show error state
     */
    function showErrorState() {
        if (!eventsList) return;
        
        eventsList.style.display = 'block';
        if (noEvents) noEvents.style.display = 'none';
        
        eventsList.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <h3>Unable to Load Events</h3>
                <button class="see-all-btn" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
    
    /**
     * Load from cache
     */
    function loadFromCache() {
        if (window.cacheManager && typeof window.cacheManager.get === 'function') {
            return window.cacheManager.get(CACHE_KEY);
        }
        
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                const age = Date.now() - (parsed.timestamp || 0);
                if (age < CACHE_TTL) {
                    return parsed.data;
                }
            }
        } catch (e) {
            console.warn('Failed to load from localStorage cache:', e);
        }
        return null;
    }
    
    /**
     * Save to cache
     */
    function saveToCache(data) {
        if (window.cacheManager && typeof window.cacheManager.set === 'function') {
            window.cacheManager.set(CACHE_KEY, data, CACHE_TTL);
        }
        
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save to localStorage cache:', e);
        }
    }
    
    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    /**
     * Refresh module
     */
    async function refresh() {
        await getCurrentUser();
        await loadEvents();
    }
    
    /**
     * Destroy module
     */
    function destroy() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        countdownIntervals.forEach(interval => clearInterval(interval));
        countdownIntervals = [];
        if (eventsList) {
            eventsList.innerHTML = '';
        }
        console.log('📅 Upcoming Events Module destroyed');
    }
    
    // Public API
    return {
        init,
        refresh,
        destroy
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UpcomingEvents.init());
} else {
    UpcomingEvents.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpcomingEvents;
}
