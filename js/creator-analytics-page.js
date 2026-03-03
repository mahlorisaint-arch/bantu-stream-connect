// js/creator-analytics-page.js — Dedicated Analytics Page Controller
// Bantu Stream Connect — Phase 5B Implementation
// ✅ FIXED: Proper supabase config, DOM checks, and auth fallback

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
      totalViews: document.getElementById('totalViews'),
      totalWatchTime: document.getElementById('totalWatchTime'),
      uniqueViewers: document.getElementById('uniqueViewers'),
      avgCompletion: document.getElementById('avgCompletion'),
      viewsChart: document.getElementById('viewsChart'),
      watchTimeChart: document.getElementById('watchTimeChart'),
      engagementChart: document.getElementById('engagementChart'),
      retentionChart: document.getElementById('retentionChart'),
      topContentBody: document.getElementById('topContentBody'),
      contentFilter: document.getElementById('contentFilter'),
      timeRangeBtns: document.querySelectorAll('.time-range-btn'),
      backBtn: document.getElementById('backBtn'),
      refreshBtn: document.getElementById('refreshBtn'),
      exportBtn: document.getElementById('exportBtn'),
      toastContainer: document.getElementById('toast-container')
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
      // Ensure supabase client exists
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
      
      // Fallback: create client directly if not available
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
          supabase: supabaseClient,  // ✅ Pass the client directly
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
      setupExportButton(analyticsManager);
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
  // RENDER FUNCTIONS
  // ============================================

  function renderDashboard(data) {
    if (!data || data.error) {
      console.error('❌ Dashboard data error:', data?.error);
      showError(data?.error || 'Failed to load data');
      return;
    }
    
    // Update summary cards (with null checks)
    if (dom.totalViews) dom.totalViews.textContent = formatNumber(data.summary?.totalViews || 0);
    if (dom.totalWatchTime) dom.totalWatchTime.textContent = formatWatchTime(data.summary?.totalWatchTime || 0);
    if (dom.uniqueViewers) dom.uniqueViewers.textContent = formatNumber(data.summary?.uniqueViewers || 0);
    if (dom.avgCompletion) dom.avgCompletion.textContent = Math.round(data.summary?.avgCompletionRate || 0) + '%';
    
    // Render charts (if Chart.js available)
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

  function loadCharts(dashboardData) {
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
    
    // Destroy existing chart
    if (charts.views) {
      charts.views.destroy();
    }
    
    // Prepare data (mock for now, replace with real data)
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = (content || []).slice(0, 7).map(c => c.views || c.realViews || Math.floor(Math.random() * 100));
    
    charts.views = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Views',
          data: data.length > 0 ? data : [12, 19, 15, 22, 18, 25, 30],
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
    
    const labels = (content || []).slice(0, 7).map((_, i) => `Day ${i + 1}`);
    const data = (content || []).slice(0, 7).map(c => (c.views || c.realViews || 0) * 0.01);
    
    charts.watchTime = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
        datasets: [{
          label: 'Watch Time (hrs)',
          data: data.length > 0 ? data : [0.12, 0.19, 0.15, 0.22, 0.18, 0.25, 0.30],
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
        plugins: { legend: { position: 'bottom', labels: { color: '#F8FAFC' } } }
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
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'var(--slate-grey)' } },
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'var(--slate-grey)', callback: v => v + '%' } }
        }
      }
    });
  }

  function loadTopContent(content) {
    const tbody = dom.topContentBody;
    if (!tbody) return;
    
    if (!content || content.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--slate-grey)">No content data available</td></tr>';
      return;
    }
    
    tbody.innerHTML = content.slice(0, 10).map((item, index) => {
      const title = item.title || 'Untitled';
      const views = item.views || item.realViews || 0;
      const thumbnail = item.thumbnail_url 
        ? (window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url)
        : 'https://via.placeholder.com/60x34';
      
      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div class="content-cell">
              <img src="${thumbnail}" alt="${escapeHtml(title)}" class="content-thumb" onerror="this.src='https://via.placeholder.com/60x34'">
              <span class="content-title" title="${escapeHtml(title)}">${truncateText(escapeHtml(title), 40)}</span>
            </div>
          </td>
          <td>${formatNumber(views)}</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>
            <button class="action-btn" onclick="window.location.href='content-detail.html?id=${item.id}'">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');
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

  function setupExportButton(analytics) {
    if (!dom.exportBtn) return;
    
    dom.exportBtn.addEventListener('click', async function() {
      if (!analytics) {
        showToast('Analytics not ready', 'warning');
        return;
      }
      
      dom.exportBtn.disabled = true;
      dom.exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
      
      try {
        const result = await analytics.exportAnalytics('csv', currentTimeRange);
        
        if (result?.csv) {
          // Download
          const blob = new Blob([result.csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.filename || `bantu-analytics-${currentTimeRange}-${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          showToast('Analytics exported successfully!', 'success');
        } else {
          showToast('Export failed: ' + (result?.error || 'Unknown error'), 'error');
        }
      } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export: ' + error.message, 'error');
      } finally {
        dom.exportBtn.disabled = false;
        dom.exportBtn.innerHTML = '<i class="fas fa-download"></i> Export CSV';
      }
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
