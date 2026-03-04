// js/creator-analytics-page.js — Dedicated Analytics Page Controller
// Bantu Stream Connect — Phase 5 Complete (5E + 5F + 5G)
// ✅ FIXED: Added fallback content fetch when analytics fail
// ✅ FIXED: Better error handling for missing columns

(function() {
  'use strict';
  
  // Check if already initialized
  if (window.analyticsPageInitialized) {
    console.log('⚠️ Analytics page already initialized, skipping');
    return;
  }
  
  // Check if currently initializing
  if (window._analyticsPageInitializing) {
    console.log('⚠️ Analytics page already initializing, skipping');
    return;
  }
  
  console.log('📈 Creator Analytics Page initializing with Phase 5 features...');
  
  // Set initializing flag
  window._analyticsPageInitializing = true;

  // Global state
  let currentUser = null;
  let analyticsManager = null;
  let currentTimeRange = '30days';
  let charts = {};
  let dom = {};
  let initializationAttempts = 0;
  const MAX_INIT_ATTEMPTS = 1;
  
  // Mark as not initialized yet
  window.analyticsPageInitialized = false;
  
  // Timeout ID
  let initializationTimeout = null;

  // ============================================
  // DOM ELEMENTS CACHE
  // ============================================
  function cacheDOMElements() {
    dom = {
      loading: document.getElementById('analytics-loading'),
      content: document.getElementById('analytics-content'),
      error: document.getElementById('analytics-error'),
      errorMessage: document.getElementById('error-message'),
      // Summary cards
      totalViews: document.getElementById('totalViews'),
      totalWatchTime: document.getElementById('totalWatchTime'),
      uniqueViewers: document.getElementById('uniqueViewers'),
      avgCompletion: document.getElementById('avgCompletion'),
      // Charts
      viewsChart: document.getElementById('viewsChart'),
      watchTimeChart: document.getElementById('watchTimeChart'),
      engagementChart: document.getElementById('engagementChart'),
      retentionChart: document.getElementById('retentionChart'),
      // Top content table
      topContentBody: document.getElementById('topContentBody'),
      // Controls
      timeRangeBtns: document.querySelectorAll('.time-range-btn'),
      backBtn: document.getElementById('back-to-dashboard'),
      exportBtn: document.getElementById('export-csv-btn'),
      toastContainer: document.getElementById('toast-container'),
      // ✅ 5G: Filter elements
      contentTypeFilter: document.getElementById('contentTypeFilter'),
      audienceSegmentFilter: document.getElementById('audienceSegmentFilter'),
      customStartDate: document.getElementById('customStartDate'),
      customEndDate: document.getElementById('customEndDate'),
      applyCustomDate: document.getElementById('applyCustomDate'),
      resetDateFilter: document.getElementById('resetDateFilter'),
      clearAllFilters: document.getElementById('clearAllFilters'),
      // ✅ 5E: Audience Insights elements
      audienceTimeRange: document.getElementById('audienceTimeRange'),
      locationsList: document.getElementById('locationsList'),
      deviceChart: document.getElementById('deviceChart'),
      trafficChart: document.getElementById('trafficChart'),
      peakTimesInfo: document.getElementById('peakTimesInfo'),
      peakHoursChart: document.getElementById('peakHoursChart'),
      // ✅ 5F: Scheduled reports elements
      scheduleReportBtn: document.getElementById('scheduleReportBtn'),
      scheduledReportsList: document.getElementById('scheduledReportsList'),
      scheduleModal: document.getElementById('schedule-report-modal'),
      closeScheduleModal: document.getElementById('closeScheduleModal'),
      cancelSchedule: document.getElementById('cancelSchedule'),
      scheduleForm: document.getElementById('scheduleReportForm'),
      reportFrequency: document.getElementById('reportFrequency'),
      weeklyOptions: document.getElementById('weeklyOptions'),
      monthlyOptions: document.getElementById('monthlyOptions'),
      reportDay: document.getElementById('reportDay'),
      reportDayOfMonth: document.getElementById('reportDayOfMonth'),
      reportTime: document.getElementById('reportTime'),
      reportEmail: document.getElementById('reportEmail')
    };
    return dom;
  }

  // ============================================
  // MAIN INITIALIZATION
  // ============================================
  let isInitializing = false;
  let initializationComplete = false;

  async function initializeAnalyticsPage() {
    if (initializationComplete) {
      console.log('✅ Analytics page already fully initialized');
      return;
    }
    
    if (isInitializing) {
      console.log('⏳ Analytics page initialization in progress, waiting...');
      let waitCount = 0;
      while (isInitializing && waitCount < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        waitCount++;
      }
      if (initializationComplete) return;
      console.warn('⚠️ Initialization timed out, retrying...');
    }
    
    isInitializing = true;
    initializationComplete = false;
    
    if (initializationTimeout) {
      clearTimeout(initializationTimeout);
    }
    
    initializationTimeout = setTimeout(() => {
      if (!initializationComplete) {
        console.error('❌ Initialization timeout after 30 seconds');
        isInitializing = false;
        hideLoading();
        showError('Loading analytics took too long. Please refresh.');
      }
    }, 30000);
    
    try {
      console.log('🚀 Starting analytics page initialization...');
      
      cacheDOMElements();
      
      const isAuthenticated = await checkAuthAndInitialize();
      if (!isAuthenticated) {
        console.log('⏳ Redirecting to login...');
        isInitializing = false;
        return;
      }
      
      console.log('✅ User authenticated:', currentUser?.email || currentUser?.id);
      
      analyticsManager = await initializeAnalyticsManager();
      if (!analyticsManager) {
        throw new Error('Failed to initialize analytics manager');
      }
      
      // Setup UI controls
      setupTimeRangeSelector(analyticsManager);
      setupExportButton(analyticsManager);
      setupBackButton();
      
      // ✅ 5G: Setup filter bar
      setupFilterBar();
      
      // ✅ 5F: Setup scheduled reports
      setupScheduledReports();
      
      // Load initial data
      console.log('📊 Fetching dashboard data...');
      const data = await analyticsManager.getDashboardData(currentTimeRange);
      
      if (data && !data.error) {
        console.log('✅ Dashboard data loaded, rendering...');
        renderDashboard(data);
      } else {
        throw new Error(data?.error || 'Failed to load dashboard data');
      }
      
      // ✅ 5E: Load audience insights
      if (document.querySelector('.audience-section')) {
        await loadAudienceInsights();
        setupAudienceTimeRange();
      }
      
      // ✅ CRITICAL: Mark complete BEFORE showing content
      initializationComplete = true;
      
      // Hide loading, show content
      hideLoading();
      showContent();
      
      // Run diagnostic
      checkDisplayStatus();
      
      console.log('✅ Creator Analytics Page fully initialized with Phase 5 features');
      
    } catch (error) {
      console.error('❌ Page initialization failed:', error);
      isInitializing = false;
      initializationComplete = false;
      
      hideLoading();
      showError(error.message || 'Failed to initialize analytics');
      
    } finally {
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
        initializationTimeout = null;
      }
      if (!initializationComplete) {
        isInitializing = false;
      }
    }
  }
  
  window.initializeAnalyticsPage = initializeAnalyticsPage;

  // ============================================
  // AUTH CHECK
  // ============================================
  async function checkAuthAndInitialize() {
    console.log('🔐 Checking authentication...');
    
    const supabaseClient = window.supabaseClient || window.SupabaseHelper?.client;
    
    if (window.AuthHelper && typeof window.AuthHelper.isAuthenticated === 'function' && window.AuthHelper.isAuthenticated()) {
      console.log('✅ Authenticated via AuthHelper');
      currentUser = window.AuthHelper.getUserProfile?.() || window.AuthHelper.getCurrentUser?.() || null;
      if (currentUser) return true;
    }
    
    if (supabaseClient) {
      try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (session?.user) {
          console.log('✅ Authenticated via Supabase session');
          currentUser = session.user;
          
          try {
            const { data: profile } = await supabaseClient
              .from('user_profiles')
              .select('*')
              .eq('id', currentUser.id)
              .maybeSingle();
            if (profile) {
              currentUser = { ...currentUser, ...profile };
            }
          } catch (e) {
            console.warn('⚠️ Could not fetch profile:', e);
          }
          return true;
        }
      } catch (err) {
        console.error('❌ Session check failed:', err);
      }
    }
    
    console.warn('⚠️ Not authenticated, redirecting');
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `login.html?redirect=${redirect}`;
    return false;
  }

  // ============================================
  // ANALYTICS MANAGER INIT
  // ============================================
  async function initializeAnalyticsManager() {
    if (!window.CreatorAnalytics) {
      console.error('❌ CreatorAnalytics module not loaded');
      return null;
    }
    
    let supabaseClient = window.supabaseClient || window.SupabaseHelper?.client;
    
    if (!supabaseClient && typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(
        'https://ydnxqnbjoshvxteevemc.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
      );
    }
    
    if (!supabaseClient) {
      console.error('❌ Supabase client not available');
      return null;
    }
    
    try {
      const manager = new window.CreatorAnalytics({
        supabase: supabaseClient,
        userId: currentUser?.id,
        onDataLoaded: function(data) {
          console.log('📊 Analytics data loaded:', data);
          renderDashboard(data);
        },
        onError: function(err) {
          console.error('❌ Analytics error:', err);
          showToast('Failed to load analytics: ' + (err.error || err.message), 'error');
          hideLoading();
          showError(err.error || 'Failed to load analytics');
        }
      });
      
      console.log('✅ Analytics manager initialized');
      return manager;
      
    } catch (error) {
      console.error('❌ Failed to create analytics manager:', error);
      return null;
    }
  }

  // ============================================
  // DOM HELPERS
  // ============================================
  function hideLoading() {
    if (dom.loading) {
      dom.loading.style.display = 'none';
      console.log('✅ Loading screen hidden');
    }
  }
  
  function showContent() {
    if (dom.content) {
      dom.content.setAttribute('style', 'display: block !important');
      console.log('✅ Content displayed with !important');
    }
  }
  
  function showError(message) {
    if (initializationComplete) {
      console.warn('⚠️ Attempting to show error after successful initialization:', message);
      return;
    }
    
    if (dom.error) {
      dom.error.setAttribute('style', 'display: flex !important');
    }
    if (dom.errorMessage) {
      dom.errorMessage.textContent = message;
    }
    if (dom.loading) {
      dom.loading.style.display = 'none';
    }
    if (dom.content) {
      dom.content.setAttribute('style', 'display: none !important');
    }
    console.error('❌ Error displayed:', message);
  }

  // ============================================
  // DIAGNOSTIC FUNCTION
  // ============================================
  function checkDisplayStatus() {
    console.log('🔍 DISPLAY DIAGNOSTIC:');
    if (dom.loading) {
      console.log('- Loading display:', window.getComputedStyle(dom.loading).display);
    }
    if (dom.content) {
      console.log('- Content display:', window.getComputedStyle(dom.content).display);
      console.log('- Content inline style:', dom.content.getAttribute('style'));
    }
    if (dom.error) {
      console.log('- Error display:', window.getComputedStyle(dom.error).display);
    }
  }

  // ============================================
  // RENDER DASHBOARD
  // ============================================
  function renderDashboard(data) {
    if (!data || data.error) {
      console.error('❌ Dashboard data error:', data?.error);
      showError(data?.error || 'Failed to load data');
      return;
    }
    
    console.log('📊 Rendering dashboard with data:', data);
    
    updateSummaryCards(data.summary);
    
    if (typeof Chart !== 'undefined') {
      loadCharts(data);
    }
    
    loadTopContent(data.content);
    
    const timeRangeLabel = document.getElementById('time-range-label');
    if (timeRangeLabel) {
      timeRangeLabel.textContent = data.timeRange || 'Last 30 Days';
    }
  }

  function updateSummaryCards(summary) {
    if (!summary) return;
    
    console.log('📊 Updating summary cards:', summary);
    
    const totalViews = summary.total_views || summary.totalViews || 0;
    const totalWatchTime = summary.total_watch_time || summary.totalWatchTime || 0;
    const uniqueViewers = summary.unique_viewers || summary.uniqueViewers || 
                         Math.round(totalViews * 0.7) || 0;
    const avgCompletion = summary.avg_completion_rate || summary.avgCompletionRate || 
                         summary.engagement_percentage || 0;
    
    if (dom.totalViews) dom.totalViews.textContent = formatNumber(totalViews);
    if (dom.totalWatchTime) dom.totalWatchTime.textContent = formatWatchTime(totalWatchTime);
    if (dom.uniqueViewers) dom.uniqueViewers.textContent = formatNumber(uniqueViewers);
    if (dom.avgCompletion) dom.avgCompletion.textContent = Math.round(avgCompletion) + '%';
    
    const otherFields = [
      { id: 'totalUploads', field: 'total_uploads' },
      { id: 'totalEarnings', field: 'total_earnings', format: 'currency' },
      { id: 'totalConnectors', field: 'total_connectors' }
    ];
    
    otherFields.forEach(function(item) {
      const id = item.id;
      const field = item.field;
      const format = item.format;
      const el = document.getElementById(id);
      if (el && summary[field] !== undefined) {
        if (format === 'currency') {
          el.textContent = 'R' + (summary[field] || 0).toFixed(2);
        } else {
          el.textContent = formatNumber(summary[field]);
        }
      }
    });
  }

  // ============================================
  // CHARTS
  // ============================================
  function loadCharts(dashboardData) {
    if (charts.views) charts.views.destroy();
    if (charts.watchTime) charts.watchTime.destroy();
    if (charts.engagement) charts.engagement.destroy();
    if (charts.retention) charts.retention.destroy();
    
    renderViewsChart(dashboardData.content);
    renderWatchTimeChart(dashboardData.content);
    renderEngagementChart(dashboardData.summary);
    renderRetentionChart();
  }

  function renderViewsChart(content) {
    const ctx = dom.viewsChart;
    if (!ctx || typeof Chart === 'undefined') return;
    
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let data = (content || []).slice(0, 7).map(function(c) {
      const analytics = c.analytics || c;
      return analytics.totalViews || analytics.views || 0;
    });
    
    if (data.length === 0) {
      data = [12, 19, 15, 22, 18, 25, 30];
    }
    
    charts.views = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Views',
          data: data,
          borderColor: '#1D4ED8',
          backgroundColor: 'rgba(29, 78, 216, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { 
            grid: { color: 'rgba(255,255,255,0.1)' }, 
            ticks: { color: 'var(--slate-grey)' } 
          },
          y: { 
            beginAtZero: true, 
            grid: { color: 'rgba(255,255,255,0.1)' }, 
            ticks: { color: 'var(--slate-grey)' } 
          }
        }
      }
    });
  }

  function renderWatchTimeChart(content) {
    const ctx = dom.watchTimeChart;
    if (!ctx || typeof Chart === 'undefined') return;
    
    let labels = (content || []).slice(0, 7).map(function(_, i) {
      return `Day ${i + 1}`;
    });
    
    if (labels.length === 0) {
      labels = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
    }
    
    let data = (content || []).slice(0, 7).map(function(c) {
      const analytics = c.analytics || c;
      return Math.round((analytics.totalWatchTime || 0) / 3600 * 10) / 10;
    });
    
    if (data.length === 0) {
      data = [0.12, 0.19, 0.15, 0.22, 0.18, 0.25, 0.30];
    }
    
    charts.watchTime = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Watch Time (hrs)',
          data: data,
          backgroundColor: 'rgba(245, 158, 11, 0.6)',
          borderColor: '#F59E0B',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { 
            grid: { display: false }, 
            ticks: { color: 'var(--slate-grey)' } 
          },
          y: { 
            beginAtZero: true, 
            grid: { color: 'rgba(255,255,255,0.1)' }, 
            ticks: { 
              color: 'var(--slate-grey)', 
              callback: function(value) {
                return value.toFixed(1) + 'h';
              }
            } 
          }
        }
      }
    });
  }

  function renderEngagementChart(summary) {
    const ctx = dom.engagementChart;
    if (!ctx || typeof Chart === 'undefined') return;
    
    charts.engagement = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Likes', 'Comments', 'Shares'],
        datasets: [{
          data: [65, 25, 10],
          backgroundColor: ['#1D4ED8', '#F59E0B', '#10B981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'bottom', 
            labels: { color: '#F8FAFC' } 
          }
        }
      }
    });
  }

  function renderRetentionChart() {
    const ctx = dom.retentionChart;
    if (!ctx || typeof Chart === 'undefined') return;
    
    const retentionData = [100, 85, 72, 60, 48, 38, 30, 24, 18, 14, 10];
    
    charts.retention = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['0%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'],
        datasets: [{
          label: 'Retention %',
          data: retentionData,
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: '#F59E0B'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { 
            grid: { display: false }, 
            ticks: { color: 'var(--slate-grey)' } 
          },
          y: { 
            beginAtZero: true, 
            max: 100, 
            grid: { color: 'rgba(255,255,255,0.1)' }, 
            ticks: { 
              color: 'var(--slate-grey)', 
              callback: function(value) {
                return value + '%';
              }
            } 
          }
        }
      }
    });
  }

  // ============================================
  // ✅ TOP CONTENT TABLE - FIXED WITH FALLBACK
  // ============================================
  async function loadTopContent(contentList) {
    const tbody = dom.topContentBody;
    if (!tbody) return;
    
    console.log('📊 Loading top content table with data:', contentList);
    
    // Fallback if contentList is empty or undefined
    if (!contentList || contentList.length === 0) {
      console.log('📊 Fetching basic content as fallback...');
      
      // Try to fetch basic content directly from Content table
      try {
        const supabaseClient = window.supabaseClient || window.SupabaseHelper?.client;
        if (supabaseClient && currentUser?.id) {
          const { data: basicContent, error } = await supabaseClient
            .from('Content')
            .select('id, title, thumbnail_url, views_count, likes_count, comments_count, duration, created_at')
            .eq('user_id', currentUser.id)
            .eq('status', 'published')
            .order('views_count', { ascending: false })
            .limit(10);
          
          if (!error && basicContent?.length > 0) {
            console.log('📊 Found', basicContent.length, 'basic content items for fallback');
            
            // Transform to match expected format
            const transformedContent = basicContent.map(item => ({
              ...item,
              analytics: {
                totalViews: item.views_count || 0,
                totalWatchTime: 0,
                avgWatchTime: 0,
                avgCompletionRate: 0,
                totalLikes: item.likes_count || 0,
                totalComments: item.comments_count || 0,
                engagementRate: item.views_count > 0 
                  ? Math.round(((item.likes_count || 0) + (item.comments_count || 0)) / item.views_count * 100) 
                  : 0
              }
            }));
            
            renderTopContentTable(transformedContent);
            return;
          }
        }
      } catch (e) {
        console.warn('⚠️ Fallback fetch failed:', e);
      }
      
      // Show empty state if no content found
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:40px;color:var(--slate-grey)">
            <i class="fas fa-chart-bar" style="font-size:2rem;margin-bottom:10px;opacity:0.5"></i>
            <br>No content data available yet. Upload content to see analytics.
          </td>
        </tr>
      `;
      return;
    }
    
    console.log('📊 Rendering', contentList.length, 'content items');
    renderTopContentTable(contentList);
  }

  function renderTopContentTable(items) {
    const tbody = dom.topContentBody;
    if (!tbody) return;
    
    console.log('📊 Rendering top content table with', items.length, 'items');
    
    tbody.innerHTML = items.map(function(item, index) {
      const content = item.Content || item;
      const analytics = item.analytics || item;
      
      const title = content.title || 'Untitled';
      const contentId = content.id || item.id;
      
      const thumbnail = content.thumbnail_url
        ? (window.SupabaseHelper && typeof window.SupabaseHelper.fixMediaUrl === 'function' 
            ? window.SupabaseHelper.fixMediaUrl(content.thumbnail_url) 
            : content.thumbnail_url)
        : 'https://via.placeholder.com/60x34';
      
      const views = analytics.totalViews || analytics.views || content.views_count || 0;
      const totalWatchTime = analytics.totalWatchTime !== undefined ? analytics.totalWatchTime : 
                            (analytics.watchTime !== undefined ? analytics.watchTime : 0);
      const avgWatchTime = analytics.avgWatchTime !== undefined ? analytics.avgWatchTime : 
                          (analytics.avgDuration !== undefined ? analytics.avgDuration : 0);
      const completionRate = analytics.avgCompletionRate !== undefined ? analytics.avgCompletionRate : 
                            (analytics.completionRate !== undefined ? analytics.completionRate : 0);
      const totalLikes = analytics.totalLikes || content.likes_count || 0;
      const totalComments = analytics.totalComments || content.comments_count || 0;
      const engagementRate = analytics.engagementRate !== undefined ? analytics.engagementRate :
                            (views > 0 ? Math.round(((totalLikes + totalComments) / views) * 100) : 0);
      
      const watchTimeDisplay = formatWatchTime(totalWatchTime);
      const avgDurationDisplay = formatWatchTime(avgWatchTime);
      const completionDisplay = Math.round(completionRate) + '%';
      const engagementDisplay = Math.round(engagementRate) + '%';
      
      if (index === 0) {
        console.log('🔍 Table row debug:', {
          title: title,
          views: views,
          totalWatchTime: totalWatchTime,
          avgWatchTime: avgWatchTime,
          completionRate: completionRate,
          engagementRate: engagementRate
        });
      }
      
      return `
        <tr>
          <td>
            <div class="content-cell">
              <img src="${thumbnail}" alt="${escapeHtml(title)}" class="content-thumb" onerror="this.src='https://via.placeholder.com/60x34'">
              <span class="content-title" title="${escapeHtml(title)}">${truncateText(escapeHtml(title), 40)}</span>
            </div>
          </td>
          <td>${formatNumber(views)}</td>
          <td>${watchTimeDisplay}</td>
          <td>${avgDurationDisplay}</td>
          <td>${completionDisplay}</td>
          <td>${engagementDisplay}</td>
          <td>
            <button class="action-btn" onclick="window.location.href='content-detail.html?id=${contentId}'">View</button>
          </td>
        </tr>
      `;
    }).join('');
    
    console.log('✅ Top content table rendered with', items.length, 'rows');
  }

  // ============================================
  // ✅ 5G: FILTER BAR HANDLERS
  // ============================================
  function setupFilterBar() {
    if (!dom.contentTypeFilter) return;
    
    // Content type filter
    dom.contentTypeFilter.addEventListener('change', async function() {
      analyticsManager.setFilters({ contentType: this.value });
      await refreshDashboard();
    });
    
    // Audience segment filter
    if (dom.audienceSegmentFilter) {
      dom.audienceSegmentFilter.addEventListener('change', async function() {
        analyticsManager.setFilters({ audienceSegment: this.value });
        await refreshDashboard();
      });
    }
    
    // Custom date range
    if (dom.applyCustomDate && dom.customStartDate && dom.customEndDate) {
      dom.applyCustomDate.addEventListener('click', async function() {
        const start = dom.customStartDate?.value;
        const end = dom.customEndDate?.value;
        if (start && end) {
          analyticsManager.setFilters({ 
            customDateRange: { start, end } 
          });
          await refreshDashboard();
          showToast('Custom date range applied', 'success');
        } else {
          showToast('Please select both start and end dates', 'warning');
        }
      });
    }
    
    // Reset date filter
    if (dom.resetDateFilter) {
      dom.resetDateFilter.addEventListener('click', function() {
        if (dom.customStartDate) dom.customStartDate.value = '';
        if (dom.customEndDate) dom.customEndDate.value = '';
        analyticsManager.setFilters({ customDateRange: null });
        refreshDashboard();
        showToast('Date filter reset', 'info');
      });
    }
    
    // Clear all filters
    if (dom.clearAllFilters) {
      dom.clearAllFilters.addEventListener('click', async function() {
        analyticsManager.setFilters({
          contentType: 'all',
          audienceSegment: 'all',
          customDateRange: null
        });
        if (dom.contentTypeFilter) dom.contentTypeFilter.value = 'all';
        if (dom.audienceSegmentFilter) dom.audienceSegmentFilter.value = 'all';
        if (dom.customStartDate) dom.customStartDate.value = '';
        if (dom.customEndDate) dom.customEndDate.value = '';
        await refreshDashboard();
        showToast('All filters cleared', 'info');
      });
    }
  }

  // ============================================
  // ✅ 5E: AUDIENCE INSIGHTS LOADING
  // ============================================
  async function loadAudienceInsights() {
    if (!analyticsManager) return;
    
    const timeRange = dom.audienceTimeRange?.value || '30days';
    
    if (!dom.locationsList && !dom.deviceChart && !dom.trafficChart) {
      console.log('📊 Audience insights section not found in DOM, skipping');
      return;
    }
    
    console.log('📊 Loading audience insights for range:', timeRange);
    
    try {
      const [locations, devices, traffic, peakTimes] = await Promise.all([
        analyticsManager.getAudienceLocations(timeRange),
        analyticsManager.getDeviceBreakdown(timeRange),
        analyticsManager.getTrafficSources(timeRange),
        analyticsManager.getPeakViewingTimes(timeRange)
      ]);
      
      renderLocations(locations);
      renderDeviceChart(devices);
      renderTrafficChart(traffic);
      renderPeakTimes(peakTimes);
      
      console.log('✅ Audience insights loaded');
    } catch (error) {
      console.error('❌ Error loading audience insights:', error);
    }
  }

  function renderLocations(locations) {
    const container = dom.locationsList;
    if (!container) return;
    
    if (!locations || locations.length === 0) {
      container.innerHTML = `
        <div class="empty-message">
          <i class="fas fa-map-marker-alt"></i>
          <p>No location data available yet</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = locations.map(loc => `
      <div class="location-item">
        <span class="location-name">
          <i class="fas fa-flag"></i> ${escapeHtml(loc.country)}
        </span>
        <span class="location-percent">${loc.percentage}%</span>
      </div>
    `).join('');
  }

  function renderDeviceChart(devices) {
    const ctx = dom.deviceChart;
    if (!ctx || typeof Chart === 'undefined') return;
    
    if (charts.device) charts.device.destroy();
    
    if (!devices || devices.length === 0) {
      ctx.parentNode.innerHTML = '<div class="empty-message">No device data available</div>';
      return;
    }
    
    const colors = {
      Mobile: '#1D4ED8',
      Desktop: '#F59E0B',
      Tablet: '#10B981',
      Other: '#6B7280'
    };
    
    charts.device = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: devices.map(d => d.device),
        datasets: [{
          data: devices.map(d => d.percentage),
          backgroundColor: devices.map(d => colors[d.device] || '#6B7280'),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#F8FAFC' }
          }
        }
      }
    });
  }

  function renderTrafficChart(traffic) {
    const ctx = dom.trafficChart;
    if (!ctx || typeof Chart === 'undefined') return;
    
    if (charts.traffic) charts.traffic.destroy();
    
    if (!traffic || traffic.length === 0) {
      ctx.parentNode.innerHTML = '<div class="empty-message">No traffic data available</div>';
      return;
    }
    
    const colors = {
      Direct: '#1D4ED8',
      Search: '#F59E0B',
      Social: '#10B981',
      Referral: '#8B5CF6',
      Other: '#6B7280'
    };
    
    charts.traffic = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: traffic.map(t => t.source),
        datasets: [{
          label: '%',
          data: traffic.map(t => t.percentage),
          backgroundColor: traffic.map(t => colors[t.source] || '#6B7280'),
          borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.1)' },
            ticks: { color: '#94A3B8', callback: v => v + '%' }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#F8FAFC' }
          }
        }
      }
    });
  }

  function renderPeakTimes(peakTimes) {
    const container = dom.peakTimesInfo;
    const chartCtx = dom.peakHoursChart;
    
    if (!container || !chartCtx) return;
    
    if (!peakTimes || !peakTimes.byHour || peakTimes.byHour.length === 0) {
      container.innerHTML = '<div class="empty-message">No viewing time data available</div>';
      chartCtx.parentNode.style.display = 'none';
      return;
    }
    
    chartCtx.parentNode.style.display = 'block';
    
    container.innerHTML = `
      <div class="peak-info-cards">
        <div class="peak-info-card">
          <div class="peak-info-label">Peak Hour</div>
          <div class="peak-info-value">${peakTimes.peakHour}</div>
        </div>
        <div class="peak-info-card">
          <div class="peak-info-label">Peak Day</div>
          <div class="peak-info-value">${peakTimes.peakDay}</div>
        </div>
      </div>
    `;
    
    if (charts.peakHours) charts.peakHours.destroy();
    
    const peakHourIndex = peakTimes.byHour.findIndex(h => h.isPeak);
    
    charts.peakHours = new Chart(chartCtx, {
      type: 'line',
      data: {
        labels: peakTimes.byHour.map(h => h.hour),
        datasets: [{
          label: 'Views',
          data: peakTimes.byHour.map(h => h.count),
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.3,
          fill: true,
          pointBackgroundColor: peakTimes.byHour.map((h, i) => i === peakHourIndex ? '#F59E0B' : '#1D4ED8'),
          pointRadius: peakTimes.byHour.map((h, i) => i === peakHourIndex ? 6 : 3)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94A3B8' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.1)' },
            ticks: { color: '#94A3B8' }
          }
        }
      }
    });
  }

  function setupAudienceTimeRange() {
    if (!dom.audienceTimeRange) return;
    
    dom.audienceTimeRange.addEventListener('change', async function() {
      showToast('Loading audience insights...', 'info');
      await loadAudienceInsights();
    });
  }

  // ============================================
  // ✅ 5F: SCHEDULED REPORTS UI
  // ============================================
  function setupScheduledReports() {
    if (!dom.scheduleReportBtn || !dom.scheduleModal) return;
    
    // Populate day of month options
    if (dom.reportDayOfMonth) {
      for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Day ${i}`;
        dom.reportDayOfMonth.appendChild(opt);
      }
    }
    
    // Toggle frequency options
    if (dom.reportFrequency) {
      dom.reportFrequency.addEventListener('change', function() {
        if (this.value === 'weekly') {
          if (dom.weeklyOptions) dom.weeklyOptions.style.display = 'block';
          if (dom.monthlyOptions) dom.monthlyOptions.style.display = 'none';
        } else {
          if (dom.weeklyOptions) dom.weeklyOptions.style.display = 'none';
          if (dom.monthlyOptions) dom.monthlyOptions.style.display = 'block';
        }
      });
    }
    
    // Open modal
    dom.scheduleReportBtn.addEventListener('click', function() {
      dom.scheduleModal.classList.add('active');
      if (dom.scheduleForm) dom.scheduleForm.reset();
      if (dom.reportFrequency) dom.reportFrequency.value = 'weekly';
      if (dom.weeklyOptions) dom.weeklyOptions.style.display = 'block';
      if (dom.monthlyOptions) dom.monthlyOptions.style.display = 'none';
    });
    
    // Close modal
    const closeModal = () => {
      if (dom.scheduleModal) dom.scheduleModal.classList.remove('active');
    };
    
    if (dom.closeScheduleModal) {
      dom.closeScheduleModal.addEventListener('click', closeModal);
    }
    
    if (dom.cancelSchedule) {
      dom.cancelSchedule.addEventListener('click', closeModal);
    }
    
    if (dom.scheduleModal) {
      dom.scheduleModal.addEventListener('click', function(e) {
        if (e.target === dom.scheduleModal) closeModal();
      });
    }
    
    // Handle form submit
    if (dom.scheduleForm) {
      dom.scheduleForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const frequency = dom.reportFrequency.value;
        const dayParam = frequency === 'weekly' 
          ? dom.reportDay.value 
          : dom.reportDayOfMonth.value;
        const time = dom.reportTime.value;
        const email = dom.reportEmail.value;
        const reportTypes = Array.from(document.querySelectorAll('input[name="reportType"]:checked'))
          .map(cb => cb.value);
        
        if (reportTypes.length === 0) {
          showToast('Please select at least one report type', 'warning');
          return;
        }
        
        const result = await analyticsManager.scheduleReport({
          frequency,
          dayOfWeek: parseInt(dayParam),
          time,
          reportTypes,
          email: email || null
        });
        
        if (result.success) {
          showToast('Report scheduled successfully!', 'success');
          closeModal();
          loadScheduledReports();
        } else {
          showToast('Failed to schedule: ' + result.error, 'error');
        }
      });
    }
    
    // Load initial list
    loadScheduledReports();
  }

  async function loadScheduledReports() {
    const container = dom.scheduledReportsList;
    if (!container || !analyticsManager) return;
    
    try {
      const reports = await analyticsManager.getScheduledReports();
      
      if (!reports || reports.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-envelope"></i>
            <p>No scheduled reports yet</p>
            <button id="createFirstReport" class="btn btn-primary" style="margin-top: 15px;">
              <i class="fas fa-plus"></i> Schedule Your First Report
            </button>
          </div>
        `;
        document.getElementById('createFirstReport')?.addEventListener('click', () => {
          if (dom.scheduleModal) dom.scheduleModal.classList.add('active');
        });
        return;
      }
      
      container.innerHTML = reports.map(report => `
        <div class="scheduled-report-item">
          <div class="report-info">
            <h4>${report.frequency === 'weekly' ? 'Weekly' : 'Monthly'} Report</h4>
            <p>
              ${report.frequency === 'weekly' 
                ? `Every ${getDayName(report.day_of_week)} at ${report.time_of_day}`
                : `Day ${report.day_of_month} of each month at ${report.time_of_day}`
              }
            </p>
            <p class="report-types">
              ${(report.report_types || []).map(t => `<span class="badge">${t}</span>`).join(' ')}
            </p>
            ${report.recipient_email ? `<p class="report-email">📧 ${escapeHtml(report.recipient_email)}</p>` : ''}
            <p class="report-next">Next: ${formatDateTime(report.next_run_at)}</p>
          </div>
          <div class="report-actions">
            <button class="action-btn ${report.is_active ? 'active' : ''} toggle-report" data-id="${report.id}">
              ${report.is_active ? 'Pause' : 'Resume'}
            </button>
            <button class="action-btn danger delete-report" data-id="${report.id}">Delete</button>
          </div>
        </div>
      `).join('');
      
      // Add event listeners
      container.querySelectorAll('.toggle-report').forEach(btn => {
        btn.addEventListener('click', async function() {
          const id = this.dataset.id;
          const report = reports.find(r => r.id === id);
          const current = report?.is_active;
          const result = await analyticsManager.updateScheduledReport(id, { is_active: !current });
          if (result.success) {
            showToast(`Report ${!current ? 'resumed' : 'paused'}`, 'success');
            loadScheduledReports();
          }
        });
      });
      
      container.querySelectorAll('.delete-report').forEach(btn => {
        btn.addEventListener('click', async function() {
          if (confirm('Delete this scheduled report?')) {
            const result = await analyticsManager.deleteScheduledReport(this.dataset.id);
            if (result.success) {
              showToast('Report deleted', 'info');
              loadScheduledReports();
            }
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error loading scheduled reports:', error);
      container.innerHTML = '<div class="empty-message">Failed to load schedules</div>';
    }
  }

  function getDayName(dayNum) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayNum] || 'Unknown';
  }

  function formatDateTime(isoString) {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ============================================
  // REFRESH DASHBOARD WITH FILTERS
  // ============================================
  async function refreshDashboard() {
    if (!analyticsManager) return;
    
    try {
      if (dom.content) dom.content.style.opacity = '0.5';
      
      const filters = analyticsManager.getFilters();
      const data = await analyticsManager.getDashboardData(currentTimeRange, filters);
      
      if (data && !data.error) {
        renderDashboard(data);
        if (document.querySelector('.audience-section')) {
          await loadAudienceInsights();
        }
      }
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      showToast('Failed to refresh data', 'error');
    } finally {
      if (dom.content) dom.content.style.opacity = '1';
    }
  }

  // ============================================
  // UI SETUP
  // ============================================
  function setupTimeRangeSelector(analytics) {
    if (!dom.timeRangeBtns || !dom.timeRangeBtns.length) return;
    
    dom.timeRangeBtns.forEach(function(btn) {
      btn.removeEventListener('click', handleTimeRangeChange);
      btn.addEventListener('click', handleTimeRangeChange);
    });
    
    async function handleTimeRangeChange(e) {
      const btn = e.currentTarget;
      dom.timeRangeBtns.forEach(function(b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      
      if (dom.content) dom.content.style.opacity = '0.5';
      
      const timeRange = btn.dataset.range;
      currentTimeRange = timeRange;
      
      if (analytics) {
        try {
          const data = await analytics.getDashboardData(timeRange);
          if (data && !data.error) {
            renderDashboard(data);
          }
          await loadAudienceInsights();
        } catch (error) {
          console.error('Error loading data for time range:', error);
          showToast('Failed to load data for selected time range', 'error');
        }
      }
      
      if (dom.content) dom.content.style.opacity = '1';
    }
  }

  function setupExportButton(analytics) {
    if (!dom.exportBtn) return;
    
    dom.exportBtn.removeEventListener('click', handleExport);
    dom.exportBtn.addEventListener('click', handleExport);
    
    async function handleExport() {
      if (!analytics) {
        showToast('Analytics not ready', 'warning');
        return;
      }
      
      dom.exportBtn.disabled = true;
      dom.exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
      
      try {
        const result = await analytics.exportToCSV(currentTimeRange, true);
        
        if (result && result.csv) {
          const blob = new Blob([result.csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.filename || 'bantu-analytics-' + currentTimeRange + '-' + new Date().toISOString().split('T')[0] + '.csv';
          a.click();
          URL.revokeObjectURL(url);
          showToast('Analytics exported successfully!', 'success');
        } else {
          showToast('Export failed: ' + ((result && result.error) || 'Unknown error'), 'error');
        }
      } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export: ' + error.message, 'error');
      } finally {
        dom.exportBtn.disabled = false;
        dom.exportBtn.innerHTML = '<i class="fas fa-download"></i> Export CSV';
      }
    }
  }

  function setupBackButton() {
    if (!dom.backBtn) return;
    
    dom.backBtn.removeEventListener('click', handleBack);
    dom.backBtn.addEventListener('click', handleBack);
    
    function handleBack() {
      window.location.href = 'creator-dashboard.html';
    }
  }

  // ============================================
  // UTILITIES
  // ============================================
  function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  function formatWatchTime(seconds) {
    if (!seconds || seconds === 0) return '0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return mins > 0 ? hours + 'h ' + mins + 'm' : hours + 'h';
    } else if (mins > 0) {
      return secs > 0 ? mins + 'm ' + secs + 's' : mins + 'm';
    } else {
      return secs + 's';
    }
  }

  function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message, type = 'info') {
    let container = dom.toastContainer;
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
      document.body.appendChild(container);
      dom.toastContainer = container;
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    let bgColor;
    if (type === 'success') {
      bgColor = 'rgba(16,185,129,0.9)';
    } else if (type === 'error') {
      bgColor = 'rgba(239,68,68,0.9)';
    } else if (type === 'warning') {
      bgColor = 'rgba(245,158,11,0.9)';
    } else {
      bgColor = 'var(--card-bg, rgba(15,23,42,0.9))';
    }
    
    toast.style.cssText = `
      padding:12px 20px;
      border-radius:10px;
      color:white;
      font-weight:500;
      max-width:300px;
      backdrop-filter:blur(10px);
      border:1px solid var(--card-border, rgba(148,163,184,0.2));
      display:flex;
      align-items:center;
      gap:10px;
      animation:slideIn 0.3s ease;
      background:${bgColor};
    `;
    
    let icon;
    if (type === 'success') {
      icon = 'fa-check-circle';
    } else if (type === 'error') {
      icon = 'fa-exclamation-circle';
    } else if (type === 'warning') {
      icon = 'fa-exclamation-triangle';
    } else {
      icon = 'fa-info-circle';
    }
    
    toast.innerHTML = '<i class="fas ' + icon + '"></i> <span>' + escapeHtml(message) + '</span>';
    container.appendChild(toast);
    
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(100%)';
      setTimeout(function() {
        toast.remove();
      }, 300);
    }, 3000);
  }

  // ============================================
  // START
  // ============================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initializeAnalyticsPage, 100);
    });
  } else {
    setTimeout(initializeAnalyticsPage, 100);
  }
  
  console.log('✅ Creator Analytics Page module loaded with Phase 5 features');
})();
