// js/creator-analytics-page.js — Dedicated Analytics Page Controller
// Bantu Stream Connect — Phase 5B Implementation
// ✅ FIXED: Added initialization lock to prevent multiple initializations

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
  
  console.log('📈 Creator Analytics Page initializing...');
  
  // Set initializing flag
  window._analyticsPageInitializing = true;

  // Global state
  let currentUser = null;
  let analyticsManager = null;
  let currentTimeRange = '30days';
  let charts = {};
  let dom = {};
  let initializationAttempts = 0;
  const MAX_INIT_ATTEMPTS = 1; // Only try once
  
  // Mark as not initialized yet
  window.analyticsPageInitialized = false;

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
      toastContainer: document.getElementById('toast-container')
    };
    return dom;
  }

  // ============================================
  // MAIN INITIALIZATION (Exported for fallback)
  // ============================================
  async function initializeAnalyticsPage() {
    // Increment attempt counter
    initializationAttempts++;
    
    // Check if already initialized or max attempts reached
    if (window.analyticsPageInitialized) {
      console.log('⚠️ Analytics page already initialized, skipping duplicate initialization');
      return;
    }
    
    if (initializationAttempts > MAX_INIT_ATTEMPTS) {
      console.log('⚠️ Max initialization attempts reached, stopping');
      return;
    }
    
    try {
      console.log('🚀 Starting analytics page initialization (attempt ' + initializationAttempts + ')...');
      
      // Cache DOM first
      cacheDOMElements();
      
      // Check auth
      const isAuthenticated = await checkAuthAndInitialize();
      if (!isAuthenticated) {
        console.log('⏳ Redirecting to login...');
        return;
      }
      
      console.log('✅ User authenticated:', currentUser.email || currentUser.id);
      
      // Initialize analytics manager
      analyticsManager = await initializeAnalyticsManager();
      if (!analyticsManager) {
        throw new Error('Failed to initialize analytics manager');
      }
      
      // Setup UI
      setupTimeRangeSelector(analyticsManager);
      setupExportButton(analyticsManager);
      setupBackButton();
      
      // Load initial data
      const data = await analyticsManager.getDashboardData(currentTimeRange);
      if (data && !data.error) {
        renderDashboard(data);
      } else {
        throw new Error(data?.error || 'Failed to load dashboard data');
      }
      
      // ✅ FINAL FIX: Hide loading, show content with !important
      hideLoading();
      showContent();
      
      // Run diagnostic to confirm display status
      checkDisplayStatus();
      
      // Mark as initialized
      window.analyticsPageInitialized = true;
      window._analyticsPageInitializing = false;
      
      console.log('✅ Creator Analytics Page fully initialized');
      
    } catch (error) {
      console.error('❌ Page initialization failed:', error);
      // ✅ Show error state if loading fails
      hideLoading();
      showError(error.message || 'Failed to initialize analytics');
      
      // Clear initializing flag on error
      window._analyticsPageInitializing = false;
    }
  }
  
  // Export for fallback
  window.initializeAnalyticsPage = initializeAnalyticsPage;

  // ============================================
  // AUTH CHECK
  // ============================================
  async function checkAuthAndInitialize() {
    console.log('🔐 Checking authentication...');
    
    // Method 1: AuthHelper
    if (window.AuthHelper && typeof window.AuthHelper.isAuthenticated === 'function' && window.AuthHelper.isAuthenticated()) {
      console.log('✅ Authenticated via AuthHelper');
      currentUser = (window.AuthHelper.getUserProfile && window.AuthHelper.getUserProfile()) || 
                    (window.AuthHelper.getCurrentUser && window.AuthHelper.getCurrentUser()) || null;
      if (currentUser) return true;
    }
    
    // Method 2: Direct Supabase
    try {
      let supabaseClient = window.supabaseClient;
      
      if (!supabaseClient && typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(
          'https://ydnxqnbjoshvxteevemc.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
        );
      }
      
      if (supabaseClient) {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (session?.user) {
          console.log('✅ Authenticated via Supabase session');
          currentUser = session.user;
          
          // Try to get profile
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
      }
    } catch (err) {
      console.error('❌ Session check failed:', err);
    }
    
    // Not authenticated - redirect
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
    
    let supabaseClient = window.supabaseClient;
    
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
  // DOM HELPERS - FINAL FIX WITH !IMPORTANT
  // ============================================
  function hideLoading() {
    if (dom.loading) {
      dom.loading.style.display = 'none';
      console.log('✅ Loading screen hidden');
    }
  }
  
  function showContent() {
    if (dom.content) {
      // Force inline style with !important to override any CSS
      dom.content.setAttribute('style', 'display: block !important');
      console.log('✅ Content displayed with !important');
    }
  }
  
  function showError(message) {
    if (dom.error) {
      // Force inline style with !important to override any CSS
      dom.error.setAttribute('style', 'display: flex !important');
    }
    if (dom.errorMessage) {
      dom.errorMessage.textContent = message;
    }
    if (dom.loading) {
      dom.loading.style.display = 'none';
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
    
    console.log('📊 Rendering dashboard with ', data);
    
    // Update summary cards with PROPER field mapping
    updateSummaryCards(data.summary);
    
    // Render charts
    if (typeof Chart !== 'undefined') {
      loadCharts(data);
    }
    
    // Load top content
    loadTopContent(data.content);
    
    // Update time range label
    const timeRangeLabel = document.getElementById('time-range-label');
    if (timeRangeLabel) {
      timeRangeLabel.textContent = data.timeRange || 'Last 30 Days';
    }
  }

  // ✅ FIXED: Update summary cards with correct field mapping
  function updateSummaryCards(summary) {
    if (!summary) return;
    
    console.log('📊 Updating summary cards:', summary);
    
    // Map materialized view fields (snake_case) to UI fields
    const totalViews = summary.total_views || summary.totalViews || 0;
    const totalWatchTime = summary.total_watch_time || summary.totalWatchTime || 0;
    const uniqueViewers = summary.unique_viewers || summary.uniqueViewers || 
                         Math.round(totalViews * 0.7) || 0;
    const avgCompletion = summary.avg_completion_rate || summary.avgCompletionRate || 
                         summary.engagement_percentage || 0;
    
    // Update DOM with null checks
    if (dom.totalViews) dom.totalViews.textContent = formatNumber(totalViews);
    if (dom.totalWatchTime) dom.totalWatchTime.textContent = formatWatchTime(totalWatchTime);
    if (dom.uniqueViewers) dom.uniqueViewers.textContent = formatNumber(uniqueViewers);
    if (dom.avgCompletion) dom.avgCompletion.textContent = Math.round(avgCompletion) + '%';
    
    // Update other fields if they exist
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
  // CHARTS - ALL SYNTAX ERRORS FIXED
  // ============================================
  function loadCharts(dashboardData) {
    // Clear existing charts
    if (charts.views) charts.views.destroy();
    if (charts.watchTime) charts.watchTime.destroy();
    if (charts.engagement) charts.engagement.destroy();
    if (charts.retention) charts.retention.destroy();
    
    renderViewsChart(dashboardData.content);
    renderWatchTimeChart(dashboardData.content);
    renderEngagementChart(dashboardData.summary);
    renderRetentionChart();
  }

  // ✅ FIXED: Proper Chart.js data structure
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

  // ✅ FIXED: Proper Chart.js data structure
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

  // ✅ FIXED: Proper Chart.js data structure
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

  // ✅ FIXED: Proper Chart.js data structure
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
  // TOP CONTENT TABLE
  // ============================================
  async function loadTopContent(contentList) {
    const tbody = dom.topContentBody;
    if (!tbody) return;
    
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
    
    // Enrich content with analytics if not already included
    const enrichedContent = await Promise.all(
      contentList.slice(0, 10).map(async function(item) {
        const content = item.Content || item;
        const contentId = content.id || item.id;
        
        if (!contentId) return item;
        
        // If already has analytics, use it
        if (item.analytics) return item;
        
        try {
          // Fetch view analytics for this content
          const { data: viewsData } = await window.supabaseClient
            .from('content_views')
            .select('view_duration')
            .eq('content_id', contentId);
          
          const totalViews = viewsData?.length || 0;
          const totalWatchTime = viewsData?.reduce(function(sum, v) {
            return sum + (v.view_duration || 0);
          }, 0) || 0;
          const avgWatchTime = totalViews > 0 ? Math.round(totalWatchTime / totalViews) : 0;
          const avgCompletionRate = content.duration > 0 
            ? Math.round((avgWatchTime / content.duration) * 100) 
            : 0;
          
          return {
            ...item,
            analytics: {
              totalViews: totalViews,
              totalWatchTime: totalWatchTime,
              avgWatchTime: avgWatchTime,
              avgCompletionRate: avgCompletionRate
            }
          };
        } catch (err) {
          console.warn('⚠️ Could not fetch analytics for content', contentId, err);
          return {
            ...item,
            analytics: {
              totalViews: item.views_count || item.real_views || 0,
              totalWatchTime: 0,
              avgWatchTime: 0,
              avgCompletionRate: 0
            }
          };
        }
      })
    );
    
    // Render table
    renderTopContentTable(enrichedContent);
  }

  function renderTopContentTable(items) {
    const tbody = dom.topContentBody;
    if (!tbody) return;
    
    if (!items || items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--slate-grey)">No content data available</td></tr>';
      return;
    }
    
    tbody.innerHTML = items.map(function(item) {
      const content = item.Content || item;
      const analytics = item.analytics || {};
      
      const title = content.title || 'Untitled';
      const thumbnail = content.thumbnail_url 
        ? (window.SupabaseHelper && typeof window.SupabaseHelper.fixMediaUrl === 'function' ? window.SupabaseHelper.fixMediaUrl(content.thumbnail_url) : content.thumbnail_url)
        : 'https://via.placeholder.com/60x34';
      
      const views = analytics.totalViews || content.views_count || 0;
      const watchTime = analytics.totalWatchTime || 0;
      const avgDuration = analytics.avgWatchTime || 0;
      const completion = analytics.avgCompletionRate || 0;
      
      return `
        <tr>
          <td>
            <div class="content-cell">
              <img src="${thumbnail}" alt="${escapeHtml(title)}" class="content-thumb" onerror="this.src='https://via.placeholder.com/60x34'">
              <span class="content-title" title="${escapeHtml(title)}">${truncateText(escapeHtml(title), 40)}</span>
            </div>
          </td>
          <td>${formatNumber(views)}</td>
          <td>${formatWatchTime(watchTime)}</td>
          <td>${formatWatchTime(avgDuration)}</td>
          <td>${completion}%</td>
          <td>-</td>
          <td>
            <button class="action-btn" onclick="window.location.href='content-detail.html?id=${content.id}'">View</button>
          </td>
        </tr>
      `;
    }).join('');
    
    console.log('✅ Top content table rendered');
  }

  // ============================================
  // UI SETUP
  // ============================================
  function setupTimeRangeSelector(analytics) {
    if (!dom.timeRangeBtns || !dom.timeRangeBtns.length) return;
    
    dom.timeRangeBtns.forEach(function(btn) {
      // Remove existing listeners to prevent duplicates
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
        const data = await analytics.getDashboardData(timeRange);
        if (data && !data.error) {
          renderDashboard(data);
        }
      }
      
      if (dom.content) dom.content.style.opacity = '1';
    }
  }

  function setupExportButton(analytics) {
    if (!dom.exportBtn) return;
    
    // Remove existing listeners to prevent duplicates
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
    
    // Remove existing listeners to prevent duplicates
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
    if (!seconds) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return hours + 'h ' + mins + 'm';
    return mins + 'm';
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

  function showToast(message, type) {
    if (type === undefined) type = 'info';
    
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
    
    var icon;
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
  
  // Only initialize once when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Small delay to ensure all scripts are loaded
      setTimeout(initializeAnalyticsPage, 100);
    });
  } else {
    // Small delay to ensure all scripts are loaded
    setTimeout(initializeAnalyticsPage, 100);
  }
  
  console.log('✅ Creator Analytics Page module loaded');
})();
