// js/creator-analytics-page.js — Creator Analytics Page Controller

// ============================================
// ✅ GLOBAL VARIABLES
// ============================================
let analyticsInstance = null;
let charts = {};
let currentTimeRange = '30days';
let currentSortMetric = 'views';
let currentTableView = 'grid';

// ============================================
// ✅ INITIALIZE ANALYTICS PAGE
// ============================================
async function initAnalyticsPage() {
  console.log('📊 Initializing Creator Analytics Page...');

  try {
    // Check if Supabase client is available
    if (!window.supabaseClient) {
      console.error('Supabase client not found');
      showToast('Analytics service unavailable', 'error');
      return;
    }

    // Show loading state
    showLoading();

    // Initialize analytics class
    analyticsInstance = await CreatorAnalytics.init(window.supabaseClient);
    
    if (!analyticsInstance) {
      showError('Could not initialize analytics. Please ensure you are logged in as a creator.');
      return;
    }

    console.log('✅ Analytics instance created for user:', analyticsInstance.userId);

    // Setup UI components
    setupTimeRangeButtons();
    setupContentFilters();
    setupTableViewToggle();
    setupExportButton();
    setupSortButtons();

    // Load initial data
    await loadDashboardData();

    // Hide loading state
    hideLoading();

    console.log('✅ Analytics Page Ready');

  } catch (error) {
    console.error('❌ Failed to initialize analytics page:', error);
    showError('Failed to load analytics. Please try refreshing the page.');
  }
}

// ============================================
// ✅ LOAD DASHBOARD DATA
// ============================================
async function loadDashboardData() {
  if (!analyticsInstance) return;

  try {
    console.log('📊 Loading dashboard data for time range:', currentTimeRange);
    
    // Show content loading states
    showContentLoading();

    // Load all data in parallel
    const [summary, topContent, watchTimeData, locations, devices] = await Promise.all([
      analyticsInstance.getDashboardSummary(currentTimeRange),
      analyticsInstance.getTopContent(currentTimeRange, currentSortMetric, 10),
      analyticsInstance.getWatchTimeByDate(currentTimeRange),
      analyticsInstance.getAudienceLocations(currentTimeRange),
      analyticsInstance.getDeviceBreakdown(currentTimeRange)
    ]);

    console.log('📊 Data loaded:', { summary, topContent, watchTimeData });

    // Update UI
    updateSummaryCards(summary);
    updateTopContentTable(topContent);
    createWatchTimeChart(watchTimeData);
    updateAudienceLocations(locations);
    updateDeviceBreakdown(devices);
    updateEngagementChart(summary);
    updateRetentionChart(watchTimeData);

    // Hide content loading states
    hideContentLoading();

  } catch (error) {
    console.error('❌ Error loading dashboard data:', error);
    showToast('Failed to load some analytics data', 'warning');
    hideContentLoading();
  }
}

// ============================================
// ✅ UPDATE SUMMARY CARDS
// ============================================
function updateSummaryCards(summary) {
  if (!summary) return;

  console.log('Updating summary cards with:', summary);

  // Total Views
  const totalViews = summary.total_views || 0;
  setElementValue('totalViews', totalViews.toLocaleString());
  
  // Watch Time (convert seconds to hours and minutes)
  const watchTimeSeconds = summary.total_watch_time || 0;
  const hours = Math.floor(watchTimeSeconds / 3600);
  const minutes = Math.floor((watchTimeSeconds % 3600) / 60);
  setElementValue('totalWatchTime', `${hours}h ${minutes}m`);
  
  // Unique Viewers
  const uniqueViewers = summary.unique_viewers || 0;
  setElementValue('uniqueViewers', uniqueViewers.toLocaleString());
  
  // Average Completion Rate
  const completionRate = summary.avg_completion_rate || 0;
  setElementValue('avgCompletion', completionRate.toFixed(1) + '%');
  
  // Hidden fields for other data
  setElementValue('totalUploads', summary.total_uploads || 0);
  setElementValue('totalEarnings', 'R' + (summary.total_earnings || 0).toFixed(2));
  setElementValue('totalConnectors', summary.total_connectors || 0);
  setElementValue('engagementRate', (summary.engagement_percentage || 0).toFixed(1) + '%');
  
  // Monetization eligibility
  const eligible = summary.is_eligible_for_monetization || false;
  const eligibleElement = document.getElementById('monetizationEligible');
  if (eligibleElement) {
    eligibleElement.textContent = eligible ? 'Eligible' : 'Not Eligible';
    eligibleElement.className = eligible ? 'badge success' : 'badge warning';
  }
}

// ============================================
// ✅ UPDATE TOP CONTENT TABLE
// ============================================
function updateTopContentTable(content) {
  const tbody = document.getElementById('topContentBody');
  if (!tbody) {
    console.error('Top content body element not found');
    return;
  }

  if (!content || content.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:40px;color:var(--slate-grey)">
          <i class="fas fa-video" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
          <p>No content found for this period</p>
        </td>
      </tr>
    `;
    return;
  }

  console.log('Updating top content table with:', content.length, 'items');

  let html = '';
  content.forEach((item, index) => {
    const thumbnail = item.thumbnail_url || 'https://via.placeholder.com/60x34?text=No+Thumb';
    const title = item.title || 'Untitled';
    const views = item.analytics?.totalViews || 0;
    const watchTime = item.analytics?.totalWatchTime || 0;
    const avgWatchTime = item.analytics?.avgWatchTime || 0;
    const completion = item.analytics?.avgCompletionRate || 0;
    
    // Format watch time
    const watchTimeHours = Math.floor(watchTime / 3600);
    const watchTimeMinutes = Math.floor((watchTime % 3600) / 60);
    const watchTimeFormatted = watchTimeHours > 0 
      ? `${watchTimeHours}h ${watchTimeMinutes}m` 
      : `${watchTimeMinutes}m`;
    
    // Format average duration
    const avgMinutes = Math.floor(avgWatchTime / 60);
    const avgSeconds = Math.floor(avgWatchTime % 60);
    const avgFormatted = avgMinutes > 0 
      ? `${avgMinutes}m ${avgSeconds}s` 
      : `${avgSeconds}s`;

    html += `
      <tr>
        <td>
          <div class="content-cell">
            <img src="${thumbnail}" alt="${title}" class="content-thumb" onerror="this.src='https://via.placeholder.com/60x34?text=Error'">
            <span class="content-title" title="${title}">${title}</span>
          </div>
        </td>
        <td>${views.toLocaleString()}</td>
        <td>${watchTimeFormatted}</td>
        <td>${avgFormatted}</td>
        <td>${completion.toFixed(1)}%</td>
        <td>
          <i class="fas fa-heart" style="color: #ef4444;"></i> ${item.analytics?.likes || 0}<br>
          <i class="fas fa-comment" style="color: #3b82f6;"></i> ${item.analytics?.comments || 0}
        </td>
        <td>
          <button class="action-btn" onclick="viewContentDetails('${item.id}')">
            <i class="fas fa-chart-line"></i> Details
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// ============================================
// ✅ CREATE WATCH TIME CHART
// ============================================
function createWatchTimeChart(data) {
  const ctx = document.getElementById('watchTimeChart')?.getContext('2d');
  if (!ctx) {
    console.error('Watch time chart canvas not found');
    return;
  }

  // Destroy existing chart
  if (charts.watchTime) {
    charts.watchTime.destroy();
  }

  if (!data || data.length === 0) {
    // Show empty state
    ctx.canvas.parentNode.innerHTML = '<p class="empty-message">No data available for this period</p>';
    return;
  }

  // Format dates for display
  const labels = data.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  
  const views = data.map(d => d.views);
  const watchHours = data.map(d => d.watchTimeHours || Math.round((d.watchTime / 3600) * 100) / 100);

  charts.watchTime = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Views',
          data: views,
          borderColor: '#FFB347',
          backgroundColor: 'rgba(255, 179, 71, 0.1)',
          borderWidth: 2,
          pointBackgroundColor: '#FFB347',
          pointBorderColor: '#0A192F',
          pointHoverBackgroundColor: '#FFB347',
          pointHoverBorderColor: '#FFFFFF',
          tension: 0.4,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Watch Time (hours)',
          data: watchHours,
          borderColor: '#1E4AE9',
          backgroundColor: 'rgba(30, 74, 233, 0.1)',
          borderWidth: 2,
          pointBackgroundColor: '#1E4AE9',
          pointBorderColor: '#0A192F',
          pointHoverBackgroundColor: '#1E4AE9',
          pointHoverBorderColor: '#FFFFFF',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: '#94A3B8',
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#1E293B',
          titleColor: '#F8FAFC',
          bodyColor: '#94A3B8',
          borderColor: '#334155',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          },
          ticks: {
            color: '#94A3B8'
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          },
          ticks: {
            color: '#94A3B8',
            callback: function(value) {
              return value.toLocaleString();
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: {
            drawOnChartArea: false,
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#94A3B8',
            callback: function(value) {
              return value + 'h';
            }
          }
        }
      }
    }
  });
}

// ============================================
// ✅ UPDATE ENGAGEMENT CHART
// ============================================
function updateEngagementChart(summary) {
  const ctx = document.getElementById('engagementChart')?.getContext('2d');
  if (!ctx) return;

  if (charts.engagement) {
    charts.engagement.destroy();
  }

  const data = {
    labels: ['Views', 'Unique Viewers', 'Connectors'],
    datasets: [{
      data: [
        summary?.total_views || 0,
        summary?.unique_viewers || 0,
        summary?.total_connectors || 0
      ],
      backgroundColor: [
        '#FFB347',
        '#1E4AE9',
        '#10b981'
      ],
      borderWidth: 0
    }]
  };

  charts.engagement = new Chart(ctx, {
    type: 'doughnut',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94A3B8'
          }
        }
      }
    }
  });
}

// ============================================
// ✅ UPDATE RETENTION CHART
// ============================================
function updateRetentionChart(data) {
  const ctx = document.getElementById('retentionChart')?.getContext('2d');
  if (!ctx) return;

  if (charts.retention) {
    charts.retention.destroy();
  }

  // Create sample retention data (in production, this would come from actual analytics)
  const retentionData = [100, 65, 45, 30, 20, 15, 10, 8, 5, 3];
  const labels = ['0%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'];

  charts.retention = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Audience Retention',
        data: retentionData,
        borderColor: '#FFB347',
        backgroundColor: 'rgba(255, 179, 71, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94A3B8'
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255,255,255,0.1)'
          },
          ticks: {
            color: '#94A3B8'
          }
        },
        y: {
          grid: {
            color: 'rgba(255,255,255,0.1)'
          },
          ticks: {
            color: '#94A3B8',
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
// ✅ UPDATE AUDIENCE LOCATIONS
// ============================================
function updateAudienceLocations(locations) {
  const container = document.getElementById('locationsList');
  if (!container) return;

  if (!locations || locations.length === 0) {
    container.innerHTML = '<p style="color: var(--slate-grey); text-align: center;">No location data available</p>';
    return;
  }

  let html = '';
  locations.slice(0, 5).forEach(loc => {
    html += `
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <span><i class="fas fa-map-marker-alt" style="color: #FFB347; margin-right: 8px;"></i>${loc.country}</span>
        <span style="color: #FFB347;">${loc.percentage}% (${loc.count})</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ============================================
// ✅ UPDATE DEVICE BREAKDOWN
// ============================================
function updateDeviceBreakdown(devices) {
  const ctx = document.getElementById('deviceChart')?.getContext('2d');
  if (!ctx) return;

  if (charts.device) {
    charts.device.destroy();
  }

  if (!devices || devices.length === 0) {
    ctx.canvas.parentNode.innerHTML = '<p class="empty-message">No device data available</p>';
    return;
  }

  const data = {
    labels: devices.map(d => d.device),
    datasets: [{
      data: devices.map(d => d.percentage),
      backgroundColor: ['#FFB347', '#1E4AE9', '#10b981', '#8b5cf6'],
      borderWidth: 0
    }]
  };

  charts.device = new Chart(ctx, {
    type: 'pie',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94A3B8'
          }
        }
      }
    }
  });
}

// ============================================
// ✅ SETUP TIME RANGE BUTTONS
// ============================================
function setupTimeRangeButtons() {
  const buttons = document.querySelectorAll('.time-range-btn');
  
  buttons.forEach(btn => {
    btn.addEventListener('click', async function() {
      // Update active state
      buttons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      // Update current time range
      currentTimeRange = this.dataset.range;
      
      console.log('Time range changed to:', currentTimeRange);
      
      // Reload data with new time range
      showContentLoading();
      await loadDashboardData();
      hideContentLoading();
    });
  });
}

// ============================================
// ✅ SETUP SORT BUTTONS
// ============================================
function setupSortButtons() {
  const sortButtons = document.querySelectorAll('.table-btn[data-sort]');
  
  sortButtons.forEach(btn => {
    btn.addEventListener('click', async function() {
      // Update active state
      sortButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      // Update sort metric
      currentSortMetric = this.dataset.sort;
      
      console.log('Sort changed to:', currentSortMetric);
      
      // Reload content with new sort
      showContentLoading();
      const topContent = await analyticsInstance.getTopContent(
        currentTimeRange, 
        currentSortMetric, 
        10
      );
      updateTopContentTable(topContent);
      hideContentLoading();
    });
  });
}

// ============================================
// ✅ SETUP CONTENT FILTERS
// ============================================
function setupContentFilters() {
  const filterSelect = document.getElementById('contentFilter');
  if (!filterSelect) return;

  filterSelect.addEventListener('change', async function() {
    const filterValue = this.value;
    console.log('Filter changed to:', filterValue);
    
    // In a real implementation, you'd filter the content by type
    showToast(`Filtering by: ${filterValue}`, 'info');
    
    // For now, just reload with current sort
    showContentLoading();
    const topContent = await analyticsInstance.getTopContent(
      currentTimeRange, 
      currentSortMetric, 
      10
    );
    updateTopContentTable(topContent);
    hideContentLoading();
  });
}

// ============================================
// ✅ SETUP TABLE VIEW TOGGLE
// ============================================
function setupTableViewToggle() {
  const gridBtn = document.getElementById('view-grid');
  const listBtn = document.getElementById('view-list');
  
  if (!gridBtn || !listBtn) return;
  
  gridBtn.addEventListener('click', function() {
    this.classList.add('active');
    listBtn.classList.remove('active');
    currentTableView = 'grid';
    
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
      tableContainer.classList.remove('list-view');
      tableContainer.classList.add('grid-view');
    }
  });
  
  listBtn.addEventListener('click', function() {
    this.classList.add('active');
    gridBtn.classList.remove('active');
    currentTableView = 'list';
    
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
      tableContainer.classList.remove('grid-view');
      tableContainer.classList.add('list-view');
    }
  });
}

// ============================================
// ✅ SETUP EXPORT BUTTON
// ============================================
function setupExportButton() {
  const exportBtn = document.getElementById('export-csv-btn');
  if (!exportBtn) {
    console.warn('⚠️ Export button not found');
    return;
  }
  
  exportBtn.addEventListener('click', async function() {
    if (!analyticsInstance) {
      showToast('Analytics not ready', 'warning');
      return;
    }
    
    // Get selected time range
    const activeRangeBtn = document.querySelector('.time-range-btn.active');
    const timeRange = activeRangeBtn?.dataset.range || '30days';
    
    // Show loading state
    const originalHTML = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    
    try {
      // Generate CSV
      const result = await analyticsInstance.exportToCSV(timeRange, true);
      
      // Trigger download
      downloadCSV(result.csv, result.filename);
      
      // Show success
      showToast(`✅ Exported ${timeRange} analytics`, 'success');
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      showToast('Failed to export: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      // Restore button
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalHTML;
    }
  });
}

// ============================================
// ✅ DOWNLOAD CSV FILE
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
// ✅ VIEW CONTENT DETAILS
// ============================================
function viewContentDetails(contentId) {
  window.location.href = `/creator/content-analytics.html?id=${contentId}`;
}

// ============================================
// ✅ HELPER: Set element value
// ============================================
function setElementValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  } else {
    console.warn(`Element with id '${id}' not found`);
  }
}

// ============================================
// ✅ LOADING STATES
// ============================================
function showLoading() {
  const loadingScreen = document.getElementById('analytics-loading');
  const content = document.getElementById('analytics-content');
  if (loadingScreen) loadingScreen.style.display = 'flex';
  if (content) content.style.display = 'none';
}

function hideLoading() {
  const loadingScreen = document.getElementById('analytics-loading');
  const content = document.getElementById('analytics-content');
  const error = document.getElementById('analytics-error');
  
  if (loadingScreen) loadingScreen.style.display = 'none';
  if (content) content.style.display = 'block';
  if (error) error.style.display = 'none';
}

function showContentLoading() {
  const tbody = document.getElementById('topContentBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:40px;color:var(--slate-grey)">
          <div class="spinner" style="width:30px;height:30px;margin:0 auto 16px;"></div>
          <p>Loading content data...</p>
        </td>
      </tr>
    `;
  }
}

function hideContentLoading() {
  // Content will be updated by the update function
}

// ============================================
// ✅ ERROR HANDLING
// ============================================
function showError(message) {
  const errorContainer = document.getElementById('analytics-error');
  const errorMessage = document.getElementById('error-message');
  const loadingScreen = document.getElementById('analytics-loading');
  const content = document.getElementById('analytics-content');
  
  if (errorMessage) errorMessage.textContent = message;
  if (errorContainer) errorContainer.style.display = 'block';
  if (loadingScreen) loadingScreen.style.display = 'none';
  if (content) content.style.display = 'none';
}

// ============================================
// ✅ TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-exclamation-circle';
  if (type === 'warning') icon = 'fa-exclamation-triangle';
  
  toast.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// ============================================
// ✅ REFRESH DATA
// ============================================
async function refreshData() {
  showContentLoading();
  await loadDashboardData();
  hideContentLoading();
  showToast('Data refreshed', 'success');
}

// ============================================
// ✅ INITIALIZE ON PAGE LOAD
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - initializing analytics page');
  
  // Check if we're on the analytics page
  if (document.getElementById('analytics-content')) {
    initAnalyticsPage();
  }
});

// Make functions available globally
window.viewContentDetails = viewContentDetails;
window.refreshData = refreshData;
window.showToast = showToast;
