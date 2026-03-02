// js/creator-analytics-page.js — Creator Analytics Page Controller
// Bantu Stream Connect — Phase 5 Implementation

(function() {
  'use strict';
  
  console.log('📊 Creator Analytics Page initializing...');
  
  // Global state
  let currentUser = null;
  let analyticsManager = null;
  let currentTimeRange = '30days';
  let charts = {};
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  async function initializePage() {
    try {
      // Check auth
      const {  { session } } = await window.supabaseClient.auth.getSession();
      if (!session?.user) {
        window.location.href = 'login.html?redirect=creator-analytics.html';
        return;
      }
      currentUser = session.user;
      
      // Initialize analytics manager
      if (window.CreatorAnalytics) {
        analyticsManager = new window.CreatorAnalytics({
          supabase: window.supabaseClient,
          userId: currentUser.id,
          onDataLoaded: (data) => {
            console.log('📊 Analytics data loaded:', data);
          },
          onError: (err) => {
            console.error('❌ Analytics error:', err);
            showToast('Analytics error', 'error');
          }
        });
      }
      
      // Load data
      await loadDashboardData();
      
      // Setup UI
      setupEventListeners();
      
      // Hide loading, show app
      document.getElementById('loading').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      
      console.log('✅ Creator Analytics Page initialized');
      
    } catch (error) {
      console.error('❌ Page initialization failed:', error);
      showToast('Failed to load analytics', 'error');
    }
  }
  
  // ============================================
  // DATA LOADING
  // ============================================
  
  async function loadDashboardData() {
    if (!analyticsManager) return;
    
    try {
      const data = await analyticsManager.getDashboardData(currentTimeRange);
      
      if (data.error) throw new Error(data.error);
      
      // Update summary cards
      updateSummaryCards(data.summary);
      
      // Load charts
      await loadCharts(data.summary);
      
      // Load top content
      await loadTopContent();
      
      // Load audience insights
      await loadAudienceInsights();
      
      // Populate content filter
      await populateContentFilter(data.content);
      
    } catch (error) {
      console.error('❌ Failed to load dashboard data:', error);
      showToast('Failed to load analytics', 'error');
    }
  }
  
  function updateSummaryCards(summary) {
    document.getElementById('totalViews').textContent = formatNumber(summary.totalViews || 0);
    document.getElementById('totalWatchTime').textContent = formatWatchTime(summary.totalWatchTime || 0);
    document.getElementById('uniqueViewers').textContent = formatNumber(summary.uniqueViewers || 0);
    document.getElementById('avgCompletion').textContent = Math.round(summary.avgCompletionRate || 0) + '%';
  }
  
  async function loadCharts(summary) {
    // Views over time chart
    const viewsData = await analyticsManager.getWatchTimeByDate(currentTimeRange);
    renderViewsChart(viewsData);
    
    // Watch time chart
    renderWatchTimeChart(viewsData);
    
    // Engagement chart
    renderEngagementChart(summary);
    
    // Retention chart
    renderRetentionChart();
  }
  
  async function loadTopContent() {
    if (!analyticsManager) return;
    
    const topContent = await analyticsManager.getTopContent(10, currentTimeRange);
    renderTopContentTable(topContent);
  }
  
  async function loadAudienceInsights() {
    // Mock data for now (replace with actual queries)
    renderLocationsChart();
    renderDeviceChart();
    renderTrafficChart();
  }
  
  async function populateContentFilter(content) {
    const select = document.getElementById('contentFilter');
    if (!select || !content) return;
    
    select.innerHTML = '<option value="all">All Content</option>' +
      content.slice(0, 20).map(item => 
        `<option value="${item.id}">${escapeHtml(item.title?.substring(0, 50) || 'Untitled')}</option>`
      ).join('');
  }
  
  // ============================================
  // CHART RENDERING
  // ============================================
  
  function renderViewsChart(viewsData) {
    const ctx = document.getElementById('viewsChart');
    if (!ctx) return;
    
    if (charts.views) charts.views.destroy();
    
    charts.views = new Chart(ctx, {
      type: 'line',
       {
        labels: viewsData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [{
          label: 'Views',
          data: viewsData.map(d => d.watchTime > 0 ? 1 : 0), // Simplified
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94A3B8' } }
        }
      }
    });
  }
  
  function renderWatchTimeChart(viewsData) {
    const ctx = document.getElementById('watchTimeChart');
    if (!ctx) return;
    
    if (charts.watchTime) charts.watchTime.destroy();
    
    charts.watchTime = new Chart(ctx, {
      type: 'bar',
       {
        labels: viewsData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [{
          label: 'Watch Time (hours)',
          data: viewsData.map(d => d.watchTimeHours),
          backgroundColor: 'rgba(29, 78, 216, 0.8)',
          borderColor: '#1D4ED8',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94A3B8' } }
        }
      }
    });
  }
  
  function renderEngagementChart(summary) {
    const ctx = document.getElementById('engagementChart');
    if (!ctx) return;
    
    if (charts.engagement) charts.engagement.destroy();
    
    charts.engagement = new Chart(ctx, {
      type: 'doughnut',
       {
        labels: ['Likes', 'Comments', 'Shares'],
        datasets: [{
          data: [65, 25, 10], // Mock data
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
    const ctx = document.getElementById('retentionChart');
    if (!ctx) return;
    
    if (charts.retention) charts.retention.destroy();
    
    const retentionData = [100, 85, 72, 60, 48, 38, 30, 24, 18, 14, 10];
    
    charts.retention = new Chart(ctx, {
      type: 'line',
       {
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
          x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94A3B8', callback: v => v + '%' } }
        }
      }
    });
  }
  
  function renderLocationsChart() {
    const locations = [
      { name: 'South Africa', percent: 68 },
      { name: 'Nigeria', percent: 12 },
      { name: 'Kenya', percent: 8 },
      { name: 'Ghana', percent: 5 },
      { name: 'Other', percent: 7 }
    ];
    
    const list = document.getElementById('locationsList');
    if (!list) return;
    
    list.innerHTML = locations.map(loc => `
      <div class="location-item">
        <span class="location-name">${loc.name}</span>
        <span class="location-percent">${loc.percent}%</span>
      </div>
    `).join('');
  }
  
  function renderDeviceChart() {
    const ctx = document.getElementById('deviceChart');
    if (!ctx) return;
    
    if (charts.device) charts.device.destroy();
    
    charts.device = new Chart(ctx, {
      type: 'doughnut',
       {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        datasets: [{
          data: [72, 22, 6],
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
  
  function renderTrafficChart() {
    const ctx = document.getElementById('trafficChart');
    if (!ctx) return;
    
    if (charts.traffic) charts.traffic.destroy();
    
    charts.traffic = new Chart(ctx, {
      type: 'bar',
       {
        labels: ['Direct', 'Search', 'Social', 'Referral'],
        datasets: [{
          label: '%',
          data: [45, 30, 18, 7],
          backgroundColor: ['#1D4ED8', '#F59E0B', '#10B981', '#8B5CF6'],
          borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94A3B8', callback: v => v + '%' } },
          y: { grid: { display: false }, ticks: { color: '#F8FAFC' } }
        }
      }
    });
  }
  
  function renderTopContentTable(items) {
    const tbody = document.getElementById('topContentBody');
    if (!tbody) return;
    
    if (!items || items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--slate-grey)">No content data available</td></tr>';
      return;
    }
    
    tbody.innerHTML = items.map(item => {
      const content = item.Content || {};
      const views = item.totalViews || 0;
      const watchTime = item.totalWatchTime || 0;
      const avgDuration = Math.round(item.avgWatchTime || 0);
      const completion = item.avgCompletionRate || 0;
      const engagement = Math.round((views > 0 ? 1 : 0) * 100); // Simplified
      
      return `
        <tr>
          <td>
            <div class="content-cell">
              <img src="${content.thumbnail_url || 'https://via.placeholder.com/60x34'}" 
                   alt="${content.title || 'Content'}" 
                   class="content-thumb"
                   onerror="this.src='https://via.placeholder.com/60x34'">
              <span class="content-title" title="${content.title || ''}">${content.title || 'Untitled'}</span>
            </div>
          </td>
          <td>${formatNumber(views)}</td>
          <td>${formatWatchTime(watchTime)}</td>
          <td>${formatWatchTime(avgDuration)}</td>
          <td>${completion}%</td>
          <td>${engagement}%</td>
          <td>
            <button class="action-btn" onclick="window.location.href='content-detail.html?id=${content.id}'">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  // ============================================
  // EVENT LISTENERS
  // ============================================
  
  function setupEventListeners() {
    // Back button
    document.getElementById('backBtn')?.addEventListener('click', () => {
      window.location.href = 'creator-dashboard.html';
    });
    
    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
      showToast('Refreshing...', 'info');
      await loadDashboardData();
      showToast('Analytics refreshed', 'success');
    });
    
    // Export button
    document.getElementById('exportBtn')?.addEventListener('click', async () => {
      if (!analyticsManager) return;
      
      showToast('Exporting...', 'info');
      const result = await analyticsManager.exportAnalytics('csv', currentTimeRange);
      
      if (result.csv) {
        const blob = new Blob([result.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'analytics-export.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('Export downloaded', 'success');
      } else {
        showToast('Export failed', 'error');
      }
    });
    
    // Time range buttons
    document.querySelectorAll('.time-range-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.time-range-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTimeRange = e.target.dataset.range;
        showToast('Loading data for ' + currentTimeRange + '...', 'info');
        await loadDashboardData();
      });
    });
    
    // Table sort buttons
    document.querySelectorAll('.table-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.table-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        await loadTopContent(); // Would implement sorting logic here
      });
    });
  }
  
  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  function formatNumber(num) {
    if (!num) return '0';
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
  
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { error: 'fa-exclamation-triangle', success: 'fa-check-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
  
  // ============================================
  // START
  // ============================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
  } else {
    initializePage();
  }
  
})();
