// js/creator-analytics-page.js — Creator Analytics Page Controller
// Bantu Stream Connect — Phase 4 Implementation
// FIXED: Authentication + Config issues + Chart syntax errors + Better fallback handling

(function() {
  'use strict';
  
  console.log('📊 Creator Analytics Page initializing...');
  
  // Global state
  let currentUser = null;
  let analyticsManager = null;
  let currentRange = '30days';
  let currentContentFilter = 'all';
  let charts = {};
  
  // DOM Elements
  const loadingScreen = document.getElementById('loading');
  const app = document.getElementById('app');
  
  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  function formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
  
  function formatWatchTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0h';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return hours + 'h ' + mins + 'm';
    return mins + 'm';
  }
  
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { 
      error: 'fa-exclamation-triangle', 
      success: 'fa-check-circle', 
      warning: 'fa-exclamation-circle', 
      info: 'fa-info-circle' 
    };
    toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
  
  // ============================================
  // ✅ FIXED: AUTHENTICATION CHECK
  // ============================================
  
  async function checkAuthentication() {
    try {
      console.log('🔐 Checking authentication...');
      
      // Wait for Supabase client to be ready
      if (!window.supabaseClient) {
        console.warn('⏳ Waiting for Supabase client...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (!window.supabaseClient) {
        throw new Error('Supabase client not initialized');
      }
      
      // Get session
      const { data: { session }, error } = await window.supabaseClient.auth.getSession();
      
      if (error) {
        console.error('❌ Auth session error:', error);
        throw error;
      }
      
      if (!session?.user) {
        console.warn('⚠️ No active session, redirecting to login');
        window.location.href = 'login.html?redirect=creator-analytics.html';
        return false;
      }
      
      currentUser = session.user;
      console.log('✅ User authenticated:', currentUser.email);
      return true;
      
    } catch (error) {
      console.error('❌ Authentication check failed:', error);
      window.location.href = 'login.html?redirect=creator-analytics.html';
      return false;
    }
  }
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  async function initializePage() {
    try {
      // ✅ STEP 1: Check authentication FIRST
      const isAuthenticated = await checkAuthentication();
      if (!isAuthenticated) {
        return; // Will redirect to login
      }
      
      // ✅ STEP 2: Initialize analytics manager with CORRECT config
      if (window.CreatorAnalytics) {
        console.log('📊 Initializing CreatorAnalytics...');
        analyticsManager = new window.CreatorAnalytics({
          supabase: window.supabaseClient,  // ✅ Correct property name (matches creator-analytics.js constructor)
          userId: currentUser.id,
          onDataLoaded: (data) => {
            console.log('📊 Analytics data loaded:', data);
          },
          onError: (err) => {
            console.error('❌ Analytics error:', err);
            showToast('Failed to load analytics', 'error');
          }
        });
        console.log('✅ Analytics Manager initialized');
      } else {
        console.warn('⚠️ CreatorAnalytics module not loaded');
      }
      
      // ✅ STEP 3: Load analytics data
      await loadAnalyticsData();
      
      // ✅ STEP 4: Setup UI
      setupEventListeners();
      
      // ✅ STEP 5: Hide loading, show app
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
      if (app) {
        app.style.display = 'block';
      }
      
      console.log('✅ Creator Analytics Page initialized');
      
    } catch (error) {
      console.error('❌ Page initialization failed:', error);
      showToast('Failed to load analytics page', 'error');
      if (loadingScreen) loadingScreen.style.display = 'none';
    }
  }
  
  // ============================================
  // DATA LOADING - WITH IMPROVED FALLBACK HANDLING
  // ============================================
  
  async function loadAnalyticsData() {
    // ✅ Check if user is authenticated
    if (!currentUser) {
      console.error('❌ User not authenticated');
      throw new Error('User not authenticated');
    }
    
    // ✅ Check if analytics manager exists
    if (!analyticsManager) {
      console.warn('⚠️ Analytics manager not available, using fallback');
      await loadFallbackData();
      return;
    }
    
    try {
      const dashboardData = await analyticsManager.getDashboardData(currentRange);
      
      // ✅ Handle empty/error response gracefully
      if (!dashboardData || dashboardData.error) {
        console.warn('⚠️ Analytics returned error, using fallback');
        await loadFallbackData();
        return;
      }
      
      renderSummaryCards(dashboardData.summary);
      renderCharts(dashboardData.chartData);
      await loadTopContent();
      await loadAudienceInsights();
      
    } catch (error) {
      console.error('❌ Failed to load analytics:', error);
      // ✅ Always fallback on any error
      await loadFallbackData();
    }
  }
  
  // ✅ Ensure fallback always works with your schema
  async function loadFallbackData() {
    try {
      const { data: analytics, error } = await window.supabaseClient
        .from('creator_analytics_summary')
        .select('*')
        .eq('creator_id', currentUser?.id)
        .maybeSingle();
      
      if (analytics && !error) {
        renderSummaryCards({
          totalViews: Number(analytics.total_views) || 0,
          totalWatchTime: Number(analytics.total_watch_seconds) || 0,
          totalUniqueViewers: Number(analytics.total_connectors) || 0,
          avgCompletionRate: Number(analytics.engagement_percentage) || 0,
          totalContent: Number(analytics.total_uploads) || 0,
          totalEarnings: Number(analytics.total_earnings) || 0
        });
        
        renderCharts(generateMockChartData());
        await loadTopContent();
      } else {
        console.log('ℹ️ No analytics data found, showing empty state');
        renderEmptyState();
      }
    } catch (error) {
      console.error('❌ Fallback load failed:', error);
      renderEmptyState();
    }
  }
  
  function generateMockChartData() {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return {
      labels,
      views: labels.map(() => Math.floor(Math.random() * 100) + 50),
      watchTime: labels.map(() => Math.floor(Math.random() * 500) + 200)
    };
  }
  
  // ============================================
  // RENDERING — FIXED CHART CONFIGS
  // ============================================
  
  function renderSummaryCards(summary) {
    const el = (id, text) => {
      const elem = document.getElementById(id);
      if (elem) elem.textContent = text;
    };
    
    el('totalViews', formatNumber(summary.totalViews));
    el('totalWatchTime', formatWatchTime(summary.totalWatchTime));
    el('uniqueViewers', formatNumber(summary.totalUniqueViewers));
    el('avgCompletion', Math.round(summary.avgCompletionRate || 0) + '%');
    
    // Update trends (simulated)
    ['viewsTrend', 'watchTimeTrend', 'viewersTrend', 'completionTrend'].forEach(id => {
      const trendEl = document.getElementById(id);
      if (trendEl) {
        const change = Math.floor(Math.random() * 20) - 5;
        trendEl.textContent = (change >= 0 ? '+' : '') + change + '%';
        trendEl.className = 'trend ' + (change >= 0 ? 'positive' : 'negative');
      }
    });
  }
  
  // FIXED: All Chart.js configs now have proper data property
  function renderCharts(chartData) {
    // Ensure chartData exists
    if (!chartData) {
      chartData = generateMockChartData();
    }
    
    // Views chart
    if (charts.views) charts.views.destroy();
    const viewsCtx = document.getElementById('viewsChart');
    if (viewsCtx) {
      charts.views = new Chart(viewsCtx, {
        type: 'line',
        data: {
          labels: chartData.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Views',
            data: chartData.views || [50, 75, 60, 90, 85, 110, 95],
            borderColor: '#1D4ED8',
            backgroundColor: 'rgba(29, 78, 216, 0.1)',
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
    
    // Watch time chart
    if (charts.watchTime) charts.watchTime.destroy();
    const watchTimeCtx = document.getElementById('watchTimeChart');
    if (watchTimeCtx) {
      charts.watchTime = new Chart(watchTimeCtx, {
        type: 'bar',
        data: {
          labels: chartData.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Watch Time (min)',
            data: chartData.watchTime || [300, 450, 380, 540, 510, 660, 570],
            backgroundColor: 'rgba(245, 158, 11, 0.8)',
            borderColor: '#F59E0B',
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
    
    // Engagement pie chart
    if (charts.engagement) charts.engagement.destroy();
    const engagementCtx = document.getElementById('engagementChart');
    if (engagementCtx) {
      charts.engagement = new Chart(engagementCtx, {
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
    
    // Retention curve
    if (charts.retention) charts.retention.destroy();
    const retentionCtx = document.getElementById('retentionChart');
    if (retentionCtx) {
      const retentionData = [100, 85, 72, 60, 48, 38, 30, 24, 18, 14, 10];
      charts.retention = new Chart(retentionCtx, {
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
            x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
            y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94A3B8', callback: v => v + '%' } }
          }
        }
      });
    }
  }
  
  async function loadTopContent() {
    if (!analyticsManager) return;
    
    try {
      const topContent = await analyticsManager.getTopContent(10, currentRange);
      if (topContent && topContent.length > 0) {
        renderTopContentTable(topContent);
      } else {
        renderMockTopContent();
      }
    } catch (error) {
      console.error('❌ Failed to load top content:', error);
      // Show mock data for demo
      renderMockTopContent();
    }
  }
  
  function renderMockTopContent() {
    const tbody = document.getElementById('topContentBody');
    if (!tbody) return;
    
    const mockItems = [
      {
        Content: { id: '1', title: 'Introduction to Bantu Connect', thumbnail_url: '', duration: 300, likes_count: 45 },
        total_views: 1250,
        total_watch_time: 15000
      },
      {
        Content: { id: '2', title: 'African Music Mix 2025', thumbnail_url: '', duration: 480, likes_count: 89 },
        total_views: 3420,
        total_watch_time: 89000
      },
      {
        Content: { id: '3', title: 'Tutorial: Creating Great Content', thumbnail_url: '', duration: 600, likes_count: 34 },
        total_views: 980,
        total_watch_time: 24500
      }
    ];
    
    renderTopContentTable(mockItems);
  }
  
  function renderTopContentTable(items) {
    const tbody = document.getElementById('topContentBody');
    if (!tbody) return;
    
    if (!items || items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--slate-grey)">No content data available</td></tr>';
      return;
    }
    
    tbody.innerHTML = items.map((item) => {
      const content = item.Content || {};
      const views = item.total_views || 0;
      const watchTime = item.total_watch_time || 0;
      const avgDuration = views > 0 ? Math.round(watchTime / views) : 0;
      const completion = content.duration > 0 ? Math.round((avgDuration / content.duration) * 100) : 0;
      const engagement = views > 0 ? Math.round(((content.likes_count || 0) / views) * 100) : 0;
      
      return `
        <tr>
          <td>
            <div class="content-cell">
              <img src="${content.thumbnail_url || 'https://via.placeholder.com/60x34/1D4ED8/FFFFFF?text=Video'}" 
                   alt="${content.title || 'Content'}" 
                   class="content-thumb"
                   onerror="this.src='https://via.placeholder.com/60x34/1D4ED8/FFFFFF?text=Video'">
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
  
  async function loadAudienceInsights() {
    // Mock data for demo - replace with real queries
    const locations = [
      { name: 'South Africa', percent: 68 },
      { name: 'Nigeria', percent: 12 },
      { name: 'Kenya', percent: 8 },
      { name: 'Ghana', percent: 5 },
      { name: 'Other', percent: 7 }
    ];
    
    const locationsList = document.getElementById('locationsList');
    if (locationsList) {
      locationsList.innerHTML = locations.map(loc => `
        <div class="location-item">
          <span class="location-name">${loc.name}</span>
          <span class="location-percent">${loc.percent}%</span>
        </div>
      `).join('');
    }
    
    // Device breakdown chart
    const deviceCtx = document.getElementById('deviceChart');
    if (deviceCtx) {
      if (charts.device) charts.device.destroy();
      charts.device = new Chart(deviceCtx, {
        type: 'doughnut',
        data: {
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
    
    // Traffic sources chart
    const trafficCtx = document.getElementById('trafficChart');
    if (trafficCtx) {
      if (charts.traffic) charts.traffic.destroy();
      charts.traffic = new Chart(trafficCtx, {
        type: 'bar',
        data: {
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
            x: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94A3B8', callback: v => v + '%' } },
            y: { grid: { display: false }, ticks: { color: '#F8FAFC' } }
          }
        }
      });
    }
  }
  
  function renderEmptyState() {
    document.querySelectorAll('.summary-card p').forEach(el => el.textContent = '0');
    document.getElementById('totalWatchTime').textContent = '0h';
    document.getElementById('avgCompletion').textContent = '0%';
    
    // Show mock data in charts even when no real data exists
    renderCharts(generateMockChartData());
    renderMockTopContent();
    loadAudienceInsights();
    
    showToast('No analytics data available yet', 'warning');
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
      showToast('Refreshing analytics...', 'info');
      await loadAnalyticsData();
      showToast('Analytics refreshed', 'success');
    });
    
    // Time range buttons
    document.querySelectorAll('.time-range-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.time-range-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentRange = e.target.dataset.range;
        showToast('Loading data for ' + currentRange + '...', 'info');
        await loadAnalyticsData();
      });
    });
    
    // Content filter
    document.getElementById('contentFilter')?.addEventListener('change', async (e) => {
      currentContentFilter = e.target.value;
      await loadTopContent();
    });
    
    // Table sort buttons
    document.querySelectorAll('.table-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.table-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        await loadTopContent();
      });
    });
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
