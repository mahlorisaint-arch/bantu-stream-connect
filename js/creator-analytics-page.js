// js/creator-analytics-page.js — Dedicated Analytics Page Controller
// Bantu Stream Connect — Phase 5B Implementation
// ✅ FIXED: Proper auth check with session wait and fallback

(function() {
  'use strict';
  
  console.log('📈 Creator Analytics Page initializing...');

  // Global state
  let currentUser = null;
  let analyticsManager = null;
  let currentTimeRange = '30days';
  let charts = {};
  
  // ============================================
  // AUTH CHECK WITH PROPER WAIT LOGIC
  // ============================================
  
  async function checkAuthAndInitialize() {
    console.log('🔐 Checking authentication for analytics page...');
    
    // Wait for AuthHelper to be available
    let authHelperReady = false;
    let supabaseReady = false;
    
    // Poll for helpers with timeout
    const waitForHelpers = async () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn('⚠️ Helpers timeout, proceeding with direct Supabase check');
          resolve();
        }, 5000);
        
        const check = setInterval(() => {
          if (window.AuthHelper?.isInitialized) {
            authHelperReady = true;
          }
          if (window.supabaseClient) {
            supabaseReady = true;
          }
          
          if (authHelperReady && supabaseReady) {
            clearInterval(check);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });
    };
    
    await waitForHelpers();
    
    // Method 1: Try AuthHelper if available
    if (window.AuthHelper?.isAuthenticated?.()) {
      console.log('✅ Authenticated via AuthHelper');
      currentUser = window.AuthHelper.getUserProfile?.() || 
                    window.AuthHelper.getCurrentUser?.() || null;
      return true;
    }
    
    // Method 2: Direct Supabase session check (fallback)
    if (window.supabaseClient) {
      try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (error) {
          console.warn('⚠️ Supabase session error:', error.message);
        }
        
        if (session?.user) {
          console.log('✅ Authenticated via direct Supabase session');
          currentUser = session.user;
          
          // Also try to get profile
          try {
            const { data: profile } = await window.supabaseClient
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
      } catch (err) {
        console.error('❌ Session check failed:', err);
      }
    }
    
    // Not authenticated
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
      // Check auth FIRST with proper waiting
      const isAuthenticated = await checkAuthAndInitialize();
      if (!isAuthenticated || !currentUser) {
        console.log('⏳ Waiting for auth or redirecting...');
        return; // Redirect handled in checkAuthAndInitialize
      }
      
      console.log('✅ User authenticated:', currentUser.email || currentUser.id);
      
      // Initialize analytics manager
      if (window.CreatorAnalytics) {
        analyticsManager = new window.CreatorAnalytics({
          supabase: window.supabaseClient,
          userId: currentUser.id,
          onDataLoaded: function(data) {
            console.log('📊 Analytics data loaded:', data);
            renderDashboard(data);
          },
          onError: function(err) {
            console.error('❌ Analytics error:', err);
            showToast('Failed to load analytics: ' + (err.error || err.message), 'error');
            document.getElementById('analytics-loading').style.display = 'none';
            document.getElementById('analytics-error').style.display = 'flex';
            document.getElementById('error-message').textContent = err.error || 'Failed to load analytics';
          }
        });
      } else {
        console.error('❌ CreatorAnalytics module not loaded');
        document.getElementById('analytics-loading').style.display = 'none';
        document.getElementById('analytics-error').style.display = 'flex';
        document.getElementById('error-message').textContent = 'Analytics module failed to load';
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
      document.getElementById('analytics-loading').style.display = 'none';
      document.getElementById('analytics-content').style.display = 'block';
      
      console.log('✅ Creator Analytics Page initialized');
      
    } catch (error) {
      console.error('❌ Page initialization failed:', error);
      document.getElementById('analytics-loading').style.display = 'none';
      document.getElementById('analytics-error').style.display = 'flex';
      document.getElementById('error-message').textContent = error.message || 'Failed to initialize';
    }
  }
  
  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  function renderDashboard(data) {
    if (!data || data.error) {
      console.error('❌ Dashboard data error:', data?.error);
      return;
    }
    
    // Update summary cards
    updateSummaryCards(data.summary);
    
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

  function updateSummaryCards(summary) {
    if (!summary) return;
    
    const cards = [
      { id: 'total-uploads', value: summary.totalUploads || 0, icon: 'fa-cloud-upload-alt' },
      { id: 'total-views', value: formatNumber(summary.totalViews || 0), icon: 'fa-eye' },
      { id: 'total-earnings', value: 'R' + ((summary.totalEarnings || 0).toFixed(2)), icon: 'fa-money-bill-wave' },
      { id: 'total-connectors', value: formatNumber(summary.totalConnectors || 0), icon: 'fa-users' }
    ];
    
    cards.forEach(card => {
      const el = document.getElementById(card.id);
      if (el) {
        el.innerHTML = `<i class="fas ${card.icon}"></i> ${card.value}`;
      }
    });
    
    // Monetization badge
    const badge = document.getElementById('monetization-badge');
    if (badge && summary.isEligibleForMonetization !== undefined) {
      if (summary.isEligibleForMonetization) {
        badge.className = 'monetization-badge eligible';
        badge.innerHTML = '<i class="fas fa-check-circle"></i> Monetization Ready';
      } else {
        badge.className = 'monetization-badge';
        badge.innerHTML = '<i class="fas fa-clock"></i> Working Toward Monetization';
      }
    }
  }

  function loadCharts(dashboardData) {
    // Views over time chart
    renderViewsChart(dashboardData.content);
    
    // Earnings chart
    renderEarningsChart(dashboardData.content);
  }

  function renderViewsChart(content) {
    const ctx = document.getElementById('views-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    // Destroy existing chart
    if (charts.views) {
      charts.views.destroy();
    }
    
    // Prepare data (last 7 items or mock)
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = (content || []).slice(0, 7).map(c => c.views || c.realViews || 0);
    
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
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: 'var(--slate-grey)' }
          },
          x: {
            grid: { display: false },
            ticks: { color: 'var(--slate-grey)' }
          }
        }
      }
    });
  }

  function renderEarningsChart(content) {
    const ctx = document.getElementById('earnings-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    if (charts.earnings) {
      charts.earnings.destroy();
    }
    
    const labels = (content || []).slice(0, 7).map((_, i) => `Day ${i + 1}`);
    const data = (content || []).slice(0, 7).map(c => (c.views || c.realViews || 0) * 0.01);
    
    charts.earnings = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
        datasets: [{
          label: 'Earnings (R)',
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
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { 
              color: 'var(--slate-grey)',
              callback: value => 'R' + value.toFixed(2)
            }
          },
          x: {
            grid: { display: false },
            ticks: { color: 'var(--slate-grey)' }
          }
        }
      }
    });
  }

  function loadTopContent(content) {
    const tbody = document.getElementById('top-content-body');
    if (!tbody) return;
    
    if (!content || content.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--slate-grey)">No content data available</td></tr>';
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
    const buttons = document.querySelectorAll('.time-range-btn');
    
    buttons.forEach(btn => {
      btn.addEventListener('click', async function() {
        // Update active state
        buttons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        // Show loading
        const content = document.getElementById('analytics-content');
        if (content) content.style.opacity = '0.5';
        
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
        if (content) content.style.opacity = '1';
      });
    });
  }

  function setupExportButton(analytics) {
    const exportBtn = document.getElementById('export-csv-btn');
    if (!exportBtn) return;
    
    exportBtn.addEventListener('click', async function() {
      if (!analytics) {
        showToast('Analytics not ready', 'warning');
        return;
      }
      
      exportBtn.disabled = true;
      exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
      
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
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fas fa-download"></i> Export CSV';
      }
    });
  }

  function setupBackButton() {
    const backBtn = document.getElementById('back-to-dashboard');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = 'creator-dashboard.html';
      });
    }
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
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
      document.body.appendChild(container);
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
