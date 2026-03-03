// js/creator-analytics-page.js — Dedicated Analytics Page Controller
// Bantu Stream Connect — Phase 5B Implementation
// ✅ FIXED: Watch time, avg duration, completion rate display
// ✅ FIXED: Proper error handling in loadTopContent
// ✅ ADDED: CSV export button handler (Phase 5D)

(function() {
  'use strict';
  
  console.log('📈 Creator Analytics Page initializing...');

  // Global state
  let currentUser = null;
  let analyticsManager = null;
  let currentTimeRange = '30days';
  let charts = {};
  
  // DOM Elements cache
  let dom = {};
  
  // ============================================
  // DOM ELEMENTS SETUP
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
      // Additional summary fields
      totalUploads: document.getElementById('totalUploads'),
      totalEarnings: document.getElementById('totalEarnings'),
      totalConnectors: document.getElementById('totalConnectors'),
      // Charts
      viewsChart: document.getElementById('viewsChart'),
      watchTimeChart: document.getElementById('watchTimeChart'),
      engagementChart: document.getElementById('engagementChart'),
      retentionChart: document.getElementById('retentionChart'),
      deviceChart: document.getElementById('deviceChart'),
      trafficChart: document.getElementById('trafficChart'),
      // Top content table
      topContentBody: document.getElementById('topContentBody'),
      contentFilter: document.getElementById('contentFilter'),
      // Controls
      timeRangeBtns: document.querySelectorAll('.time-range-btn'),
      tableSortBtns: document.querySelectorAll('.table-btn'),
      backBtn: document.getElementById('backBtn'),
      refreshBtn: document.getElementById('refreshBtn'),
      exportBtn: document.getElementById('export-csv-btn'), // Updated ID
      toastContainer: document.getElementById('toast-container'),
      // Locations list
      locationsList: document.getElementById('locationsList')
    };
    return dom;
  }
  
  // ============================================
  // AUTH CHECK WITH PROPER WAIT LOGIC
  // ============================================
  
  async function checkAuthAndInitialize() {
    console.log('🔐 Checking authentication for analytics page...');
    
    // Method 1: Try AuthHelper if available and initialized
    if (window.AuthHelper?.isAuthenticated?.()) {
      console.log('✅ Authenticated via AuthHelper');
      currentUser = window.AuthHelper.getUserProfile?.() || 
                    window.AuthHelper.getCurrentUser?.() || null;
      if (currentUser) return true;
    }
    
    // Method 2: Direct Supabase session check (fallback)
    try {
      let supabaseClient = window.supabaseClient;
      
      if (!supabaseClient && typeof supabase !== 'undefined') {
        console.log('🔄 Creating direct Supabase client for analytics...');
        supabaseClient = supabase.createClient(
          'https://ydnxqnbjoshvxteevemc.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
        );
      }
      
      if (supabaseClient) {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
          console.warn('⚠️ Supabase session error:', error.message);
        }
        
        if (session?.user) {
          console.log('✅ Authenticated via direct Supabase session');
          currentUser = session.user;
          
          // Also try to get profile
          try {
            const { data: profile } = await supabaseClient
              .from('user_profiles')
              .select('*')
              .eq('id', currentUser.id)
              .maybeSingle();
            
            if (profile) {
              currentUser = { ...currentUser, ...profile };
            }
          } catch (profileErr) {
            console.warn('⚠️ Could not fetch user profile:', profileErr);
          }
          
          return true;
        }
      }
    } catch (err) {
      console.error('❌ Session check failed:', err);
    }
    
    // Not authenticated - redirect
    console.warn('⚠️ User not authenticated, redirecting to login');
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `login.html?redirect=${redirect}`;
    return false;
  }
  
  // ============================================
  // MAIN INITIALIZATION
  // ============================================
  
  async function initializePage() {
    try {
      // Cache DOM elements first
      cacheDOMElements();
      
      // Check auth FIRST
      const isAuthenticated = await checkAuthAndInitialize();
      if (!isAuthenticated || !currentUser) {
        console.log('⏳ Waiting for auth or redirecting...');
        return;
      }
      
      console.log('✅ User authenticated:', currentUser.email || currentUser.id);
      
      // Initialize analytics manager with DIRECT supabase client
      let supabaseClient = window.supabaseClient;
      
      if (!supabaseClient && typeof supabase !== 'undefined') {
        console.log('🔄 Creating direct Supabase client for analytics module...');
        supabaseClient = supabase.createClient(
          'https://ydnxqnbjoshvxteevemc.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
        );
      }
      
      if (!supabaseClient) {
        throw new Error('Supabase client not available');
      }
      
      if (window.CreatorAnalytics) {
        analyticsManager = new window.CreatorAnalytics({
          supabase: supabaseClient,
          userId: currentUser.id,
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
      } else {
        console.error('❌ CreatorAnalytics module not loaded');
        hideLoading();
        showError('Analytics module failed to load');
        return;
      }
      
      // Setup UI
      setupTimeRangeSelector(analyticsManager);
      setupTableSorting();
      setupExportButton(analyticsManager); // ✅ New export handler
      setupRefreshButton();
      setupBackButton();
      
      // Load initial data
      if (analyticsManager) {
        await analyticsManager.getDashboardData(currentTimeRange);
      }
      
      // Hide loading, show content
      hideLoading();
      showContent();
      
      console.log('✅ Creator Analytics Page initialized');
      
    } catch (error) {
      console.error('❌ Page initialization failed:', error);
      hideLoading();
      showError(error.message || 'Failed to initialize');
    }
  }
  
  // ============================================
  // DOM HELPERS
  // ============================================
  
  function hideLoading() {
    if (dom.loading) {
      dom.loading.style.display = 'none';
    }
  }
  
  function showContent() {
    if (dom.content) {
      dom.content.style.display = 'block';
    }
  }
  
  function showError(message) {
    if (dom.error) {
      dom.error.style.display = 'flex';
    }
    if (dom.errorMessage) {
      dom.errorMessage.textContent = message;
    }
  }
  
  // ============================================
  // ✅ FIXED: RENDER DASHBOARD WITH PROPER DATA MAPPING
  // ============================================

  function renderDashboard(data) {
    if (!data || data.error) {
      console.error('❌ Dashboard data error:', data?.error);
      showError(data?.error || 'Failed to load data');
      return;
    }
    
    console.log('📊 Rendering dashboard with data:', data);
    
    // Update summary cards with PROPER FIELD MAPPING
    updateSummaryCards(data.summary);
    
    // Render charts (if Chart.js available)
    if (typeof Chart !== 'undefined') {
      renderCharts(data);
    }
    
    // Load top content table
    if (data.content) {
      loadTopContent(data.content);
    } else {
      loadTopContent([]);
    }
    
    // Load audience insights
    loadAudienceInsights();
    
    // Update time range label
    const timeRangeLabel = document.getElementById('time-range-label');
    if (timeRangeLabel) {
      timeRangeLabel.textContent = data.timeRange || 'Last 30 Days';
    }
  }

  // ✅ FIXED: Update summary cards with ALL metrics including watch time & completion
  function updateSummaryCards(summary) {
    if (!summary) return;
    
    console.log('📊 Updating summary cards with:', summary);
    
    // Total Views
    if (dom.totalViews) {
      const views = summary.totalViews || summary.total_views || 0;
      dom.totalViews.textContent = formatNumber(views);
    }
    
    // ✅ Watch Time - Convert seconds to human-readable format
    if (dom.totalWatchTime) {
      const watchTimeSeconds = summary.totalWatchTime || summary.total_watch_time || 0;
      dom.totalWatchTime.textContent = formatWatchTime(watchTimeSeconds);
    }
    
    // ✅ Unique Viewers
    if (dom.uniqueViewers) {
      const unique = summary.uniqueViewers || summary.unique_viewers || 0;
      dom.uniqueViewers.textContent = formatNumber(unique);
    }
    
    // ✅ Avg. Completion Rate
    if (dom.avgCompletion) {
      const completion = summary.avgCompletionRate || 
                        summary.avg_completion_rate || 
                        summary.engagementPercentage || 
                        summary.engagement_percentage || 
                        0;
      dom.avgCompletion.textContent = Math.round(completion) + '%';
    }
    
    // Update other summary fields if they exist in DOM
    const otherFields = [
      { id: 'totalUploads', field: 'totalUploads', label: 'Uploads' },
      { id: 'totalEarnings', field: 'totalEarnings', format: 'currency' },
      { id: 'totalConnectors', field: 'totalConnectors', label: 'Connectors' }
    ];
    
    otherFields.forEach(({ id, field, format }) => {
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

  // ✅ FIXED: Load top content with proper error handling
  function loadTopContent(contentList) {
    const tbody = dom.topContentBody;
    if (!tbody) {
      console.warn('⚠️ topContentBody element not found');
      return;
    }
    
    // Handle empty or invalid content list
    if (!contentList || !Array.isArray(contentList) || contentList.length === 0) {
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
    
    console.log('📊 Loading top content table with', contentList.length, 'items');
    
    // Render table rows with analytics
    renderTopContentTable(contentList.slice(0, 10));
  }

  // ✅ FIXED: Render table with proper metric columns
  function renderTopContentTable(items) {
    const tbody = dom.topContentBody;
    if (!tbody) return;
    
    if (!items || items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--slate-grey)">No content data available</td></tr>';
      return;
    }
    
    tbody.innerHTML = items.map((item, index) => {
      const content = item.Content || item;
      const analytics = item.analytics || {};
      
      const title = content.title || 'Untitled';
      const thumbnail = content.thumbnail_url 
        ? (window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url)
        : 'https://via.placeholder.com/60x34';
      
      const views = analytics.totalViews || content.views_count || 0;
      const watchTime = analytics.totalWatchTime || 0;
      const avgDuration = analytics.avgWatchTime || 0;
      const completion = analytics.avgCompletionRate || 0;
      const engagement = analytics.uniqueViewers || 0;
      
      return `
        <tr>
          <td>
            <div class="content-cell">
              <img src="${thumbnail}" 
                   alt="${escapeHtml(title)}" 
                   class="content-thumb"
                   onerror="this.src='https://via.placeholder.com/60x34'">
              <span class="content-title" title="${escapeHtml(title)}">${truncateText(escapeHtml(title), 40)}</span>
            </div>
          </td>
          <td>${formatNumber(views)}</td>
          <td>${formatWatchTime(watchTime)}</td>
          <td>${formatDuration(avgDuration)}</td>
          <td>${completion}%</td>
          <td>${formatNumber(engagement)}</td>
          <td>
            <button class="action-btn" onclick="window.location.href='content-detail.html?id=${content.id}'">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');
    
    console.log('✅ Top content table rendered with analytics');
  }

  // ============================================
  // ✅ EXPORT BUTTON SETUP (Phase 5D)
  // ============================================
  function setupExportButton(analytics) {
    if (!dom.exportBtn) {
      console.warn('⚠️ Export button not found');
      return;
    }
    
    dom.exportBtn.addEventListener('click', async function() {
      if (!analytics) {
        showToast('Analytics not ready', 'warning');
        return;
      }
      
      // Get selected time range from active button
      const activeRangeBtn = document.querySelector('.time-range-btn.active');
      const timeRange = activeRangeBtn?.dataset.range || currentTimeRange;
      
      // Show loading state
      const originalHTML = dom.exportBtn.innerHTML;
      dom.exportBtn.disabled = true;
      dom.exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
      
      try {
        // Generate CSV using the new export method
        const result = await analytics.exportToCSV(timeRange, true);
        
        // Trigger download
        downloadCSV(result.csv, result.filename);
        
        // Show success
        showToast(`✅ Exported ${timeRange} analytics`, 'success');
        
      } catch (error) {
        console.error('❌ Export failed:', error);
        showToast('Failed to export: ' + (error.message || 'Unknown error'), 'error');
      } finally {
        // Restore button
        dom.exportBtn.disabled = false;
        dom.exportBtn.innerHTML = originalHTML;
      }
    });
  }

  // ============================================
  // ✅ DOWNLOAD CSV FILE (Phase 5D)
  // ============================================
  function downloadCSV(csvContent, filename) {
    // Create blob with UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    // Create download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    console.log('📥 CSV downloaded:', filename);
  }

  // ============================================
  // AUDIENCE INSIGHTS
  // ============================================
  
  async function loadAudienceInsights() {
    if (!analyticsManager || !dom.locationsList) return;
    
    // Mock data for now - would come from real analytics
    const locations = [
      { country: 'South Africa', percentage: 65 },
      { country: 'Nigeria', percentage: 15 },
      { country: 'Kenya', percentage: 10 },
      { country: 'Ghana', percentage: 5 },
      { country: 'Other', percentage: 5 }
    ];
    
    dom.locationsList.innerHTML = locations.map(loc => 
      `<div class="location-item">
        <span class="location-name">${loc.country}</span>
        <span class="location-percent">${loc.percentage}%</span>
      </div>`
    ).join('');
    
    // Render device chart
    if (dom.deviceChart && typeof Chart !== 'undefined') {
      renderDeviceChart();
    }
    
    // Render traffic chart
    if (dom.trafficChart && typeof Chart !== 'undefined') {
      renderTrafficChart();
    }
  }
  
  function renderDeviceChart() {
    if (!dom.deviceChart) return;
    
    if (charts.device) {
      charts.device.destroy();
    }
    
    charts.device = new Chart(dom.deviceChart, {
      type: 'doughnut',
      data: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        datasets: [{
          data: [70, 25, 5],
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
  
  function renderTrafficChart() {
    if (!dom.trafficChart) return;
    
    if (charts.traffic) {
      charts.traffic.destroy();
    }
    
    charts.traffic = new Chart(dom.trafficChart, {
      type: 'doughnut',
      data: {
        labels: ['Direct', 'Social', 'Search', 'External'],
        datasets: [{
          data: [45, 30, 15, 10],
          backgroundColor: ['#1D4ED8', '#F59E0B', '#10B981', '#EF4444'],
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

  // ============================================
  // CHART RENDERING
  // ============================================
  
  function renderCharts(dashboardData) {
    // Views over time chart
    renderViewsChart(dashboardData.content);
    
    // Watch time chart
    renderWatchTimeChart(dashboardData.content);
    
    // Engagement chart
    renderEngagementChart(dashboardData.summary);
    
    // Retention chart
    renderRetentionChart();
  }

  function renderViewsChart(content) {
    const ctx = dom.viewsChart;
    if (!ctx || typeof Chart === 'undefined') return;
    
    if (charts.views) {
      charts.views.destroy();
    }
    
    // Generate mock data for now (replace with real time-series data)
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = [12, 19, 15, 22, 18, 25, 30];
    
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
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: 'var(--slate-grey)' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: 'var(--slate-grey)' }
          }
        }
      }
    });
  }

  function renderWatchTimeChart(content) {
    const ctx = dom.watchTimeChart;
    if (!ctx || typeof Chart === 'undefined') return;
    
    if (charts.watchTime) {
      charts.watchTime.destroy();
    }
    
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = [2.5, 3.8, 2.2, 4.1, 3.2, 5.0, 4.5]; // Hours
    
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
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { 
              color: 'var(--slate-grey)',
              callback: value => value.toFixed(1) + 'h'
            }
          }
        }
      }
    });
  }

  function renderEngagementChart(summary) {
    const ctx = dom.engagementChart;
    if (!ctx || typeof Chart === 'undefined') return;
    
    if (charts.engagement) {
      charts.engagement.destroy();
    }
    
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
    
    if (charts.retention) {
      charts.retention.destroy();
    }
    
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
              callback: v => v + '%' 
            } 
          }
        }
      }
    });
  }

  // ============================================
  // UI SETUP FUNCTIONS
  // ============================================

  function setupTimeRangeSelector(analytics) {
    if (!dom.timeRangeBtns?.length) return;
    
    dom.timeRangeBtns.forEach(btn => {
      btn.addEventListener('click', async function() {
        // Update active state
        dom.timeRangeBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        // Show loading
        if (dom.content) dom.content.style.opacity = '0.5';
        
        // Fetch new data
        const timeRange = this.dataset.range;
        currentTimeRange = timeRange;
        
        if (analytics) {
          const data = await analytics.getDashboardData(timeRange);
          if (data && !data.error) {
            renderDashboard(data);
          }
        }
        
        // Hide loading
        if (dom.content) dom.content.style.opacity = '1';
      });
    });
  }

  function setupTableSorting() {
    if (!dom.tableSortBtns?.length) return;
    
    dom.tableSortBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        dom.tableSortBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const sortBy = this.dataset.sort;
        sortTopContent(sortBy);
      });
    });
  }
  
  async function sortTopContent(sortBy) {
    if (!analyticsManager) return;
    
    try {
      const topContent = await analyticsManager.getTopContent(10, currentTimeRange);
      
      if (!topContent || topContent.length === 0) return;
      
      let sorted = [...topContent];
      
      switch(sortBy) {
        case 'views':
          sorted.sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0));
          break;
        case 'watchtime':
          sorted.sort((a, b) => (b.totalWatchTime || 0) - (a.totalWatchTime || 0));
          break;
        case 'engagement':
          sorted.sort((a, b) => (b.uniqueViewers || 0) - (a.uniqueViewers || 0));
          break;
        default:
          break;
      }
      
      renderTopContentTable(sorted);
      
    } catch (err) {
      console.error('❌ Failed to sort content:', err);
    }
  }

  function setupRefreshButton() {
    if (!dom.refreshBtn || !analyticsManager) return;
    
    dom.refreshBtn.addEventListener('click', async function() {
      dom.refreshBtn.disabled = true;
      dom.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      
      await analyticsManager.getDashboardData(currentTimeRange);
      
      dom.refreshBtn.disabled = false;
      dom.refreshBtn.innerHTML = '<i class="fas fa-redo-alt"></i>';
      showToast('Analytics refreshed', 'success');
    });
  }

  function setupBackButton() {
    if (!dom.backBtn) return;
    
    dom.backBtn.addEventListener('click', () => {
      window.location.href = 'creator-dashboard.html';
    });
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  function formatWatchTime(seconds) {
    if (!seconds) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
  
  function formatDuration(seconds) {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
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
    // Create container if doesn't exist
    let container = dom.toastContainer;
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
      document.body.appendChild(container);
      dom.toastContainer = container;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
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
      background:${type === 'success' ? 'rgba(16,185,129,0.9)' : type === 'error' ? 'rgba(239,68,68,0.9)' : type === 'warning' ? 'rgba(245,158,11,0.9)' : 'var(--card-bg, rgba(15,23,42,0.9))'};
    `;
    
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle', 
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };
    
    toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ============================================
  // START
  // ============================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
  } else {
    initializePage();
  }
  
  console.log('✅ Creator Analytics Page module loaded');
})();
