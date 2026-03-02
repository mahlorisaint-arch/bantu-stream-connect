// js/creator-analytics-page.js — Dedicated Analytics Page Controller
// Bantu Stream Connect — Phase 5B Implementation
// FIXED: Syntax errors resolved

(function() {
  'use strict';
  
  console.log('📈 Creator Analytics Page loading...');

  // Wait for DOM and dependencies
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ DOM ready, initializing analytics page...');
    
    // Check auth first
    if (!window.AuthHelper?.isAuthenticated?.()) {
      window.location.href = 'login.html?redirect=creator-analytics.html';
      return;
    }
    
    const userProfile = window.AuthHelper.getUserProfile();
    if (!userProfile?.id) {
      console.error('❌ No user profile found');
      return;
    }
    
    // Initialize analytics module
    if (!window.CreatorAnalytics) {
      console.error('❌ CreatorAnalytics module not loaded');
      document.getElementById('analytics-loading').style.display = 'none';
      document.getElementById('analytics-error').style.display = 'flex';
      return;
    }
    
    const analytics = new window.CreatorAnalytics({
      supabase: window.supabaseClient,
      userId: userProfile.id,
      onDataLoaded: function(data) {
        console.log('📊 Analytics data loaded:', data);
        renderDashboard(data);
      },
      onError: function(err) {
        console.error('❌ Analytics error:', err);
        document.getElementById('analytics-loading').style.display = 'none';
        document.getElementById('analytics-error').style.display = 'flex';
        document.getElementById('error-message').textContent = err.error || 'Failed to load analytics';
      }
    });
    
    // Setup UI
    setupTimeRangeSelector(analytics);
    setupExportButton(analytics);
    setupBackButton();
    
    // Load initial data
    await analytics.getDashboardData('30days');
  });

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  function renderDashboard(data) {
    // Hide loading, show content
    document.getElementById('analytics-loading').style.display = 'none';
    document.getElementById('analytics-content').style.display = 'block';
    
    // Update summary cards
    updateSummaryCards(data.summary);
    
    // Render charts
    renderViewsChart(data.content);
    renderEarningsChart(data.content);
    
    // Render top content table
    renderTopContentTable(data.content);
    
    // Update time range label
    document.getElementById('time-range-label').textContent = data.timeRange;
  }

  function updateSummaryCards(summary) {
    const cards = [
      { id: 'total-uploads', value: summary.totalUploads, icon: 'fa-cloud-upload-alt' },
      { id: 'total-views', value: formatNumber(summary.totalViews), icon: 'fa-eye' },
      { id: 'total-earnings', value: 'R' + (summary.totalEarnings || 0).toFixed(2), icon: 'fa-money-bill-wave' },
      { id: 'total-connectors', value: formatNumber(summary.totalConnectors), icon: 'fa-users' }
    ];
    
    cards.forEach(card => {
      const el = document.getElementById(card.id);
      if (el) {
        el.innerHTML = `<i class="fas ${card.icon}"></i> ${card.value}`;
      }
    });
    
    // Monetization badge
    const badge = document.getElementById('monetization-badge');
    if (badge) {
      if (summary.isEligibleForMonetization) {
        badge.className = 'monetization-badge eligible';
        badge.innerHTML = '<i class="fas fa-check-circle"></i> Monetization Ready';
      } else {
        badge.className = 'monetization-badge';
        badge.innerHTML = '<i class="fas fa-clock"></i> Working Toward Monetization';
      }
    }
  }

  function renderViewsChart(content) {
    const ctx = document.getElementById('views-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    // Destroy existing chart
    if (window.viewsChart) {
      window.viewsChart.destroy();
    }
    
    // Prepare data (last 7 days)
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = content.slice(0, 7).map(c => c.views || 0);
    
    window.viewsChart = new Chart(ctx, {
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
    
    if (window.earningsChart) {
      window.earningsChart.destroy();
    }
    
    const labels = content.slice(0, 7).map((_, i) => `Day ${i + 1}`);
    const data = content.slice(0, 7).map(c => (c.views || 0) * 0.01);
    
    window.earningsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Earnings (R)',
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

  function renderTopContentTable(content) {
    const tbody = document.getElementById('top-content-body');
    if (!tbody) return;
    
    tbody.innerHTML = content.slice(0, 10).map((item, index) => {
      const thumbnail = item.thumbnail_url 
        ? window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url
        : 'https://via.placeholder.com/60x34';
      
      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div class="content-cell">
              <img src="${thumbnail}" alt="${item.title}" class="content-thumb" onerror="this.src='https://via.placeholder.com/60x34'">
              <span class="content-title">${truncateText(item.title, 40)}</span>
            </div>
          </td>
          <td>${formatNumber(item.views || 0)}</td>
          <td>${formatDuration(item.avgWatchTime || 0)}</td>
          <td>${item.avgCompletionRate || 0}%</td>
          <td>
            <button class="action-btn" onclick="window.location.href='content-detail.html?id=${item.content_id}'">
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
        document.getElementById('analytics-content').style.opacity = '0.5';
        
        // Fetch new data
        const timeRange = this.dataset.range;
        const data = await analytics.getDashboardData(timeRange);
        
        // Render
        if (data && !data.error) {
          renderDashboard(data);
        }
        
        // Hide loading
        document.getElementById('analytics-content').style.opacity = '1';
      });
    });
  }

  function setupExportButton(analytics) {
    const exportBtn = document.getElementById('export-csv-btn');
    if (!exportBtn) return;
    
    exportBtn.addEventListener('click', async function() {
      const timeRange = document.querySelector('.time-range-btn.active')?.dataset.range || '30days';
      
      exportBtn.disabled = true;
      exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
      
      try {
        const csv = await analytics.exportAnalytics('csv', timeRange);
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bantu-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('Analytics exported successfully!', 'success');
      } catch (error) {
        console.error('Export failed:', error);
        showToast('Failed to export analytics', 'error');
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

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0m 0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  console.log('✅ Creator Analytics Page module loaded successfully');
})();
