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

    // Update user info
    await updateUserInfo();

    // Setup UI components
    setupTimeRangeButtons();
    setupContentFilters();
    setupTableViewToggle();
    setupExportButton(); // ✅ NEW: Added export button setup

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
// ✅ UPDATE USER INFO
// ============================================
async function updateUserInfo() {
  try {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (user) {
      const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', user.id)
        .single();

      if (profile) {
        document.getElementById('creator-name').textContent = profile.full_name || profile.username || 'Creator';
        if (profile.avatar_url) {
          document.getElementById('creator-avatar').src = profile.avatar_url;
        }
      }
    }
  } catch (error) {
    console.error('Error updating user info:', error);
  }
}

// ============================================
// ✅ LOAD DASHBOARD DATA
// ============================================
async function loadDashboardData() {
  if (!analyticsInstance) return;

  try {
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

    // Update UI
    updateSummaryCards(summary);
    updateTopContentTable(topContent);
    createWatchTimeChart(watchTimeData);
    updateAudienceLocations(locations);
    updateDeviceBreakdown(devices);

    // Hide content loading states
    hideContentLoading();

  } catch (error) {
    console.error('❌ Error loading dashboard data:', error);
    showToast('Failed to load some analytics data', 'warning');
    hideContentLoading();
  }
}

// ============================================
// ✅ SUMMARY CARDS
// ============================================
function updateSummaryCards(summary) {
  if (!summary) return;

  // Total Views
  animateValue('total-views', 0, summary.total_views || 0, 1000);
  
  // Watch Time (convert seconds to hours)
  const watchTimeHours = summary.total_watch_time ? 
    Math.round((summary.total_watch_time / 3600) * 10) / 10 : 0;
  animateValue('watch-time-hours', 0, watchTimeHours, 1000, 'h');
  
  // Unique Viewers
  animateValue('unique-viewers', 0, summary.unique_viewers || 0, 1000);
  
  // Total Earnings
  animateValue('total-earnings', 0, summary.total_earnings || 0, 1000, 'R');
  
  // Total Connectors
  animateValue('total-connectors', 0, summary.total_connectors || 0, 1000);
  
  // Average Completion Rate
  animateValue('completion-rate', 0, summary.avg_completion_rate || 0, 1000, '%');
  
  // Engagement Rate
  animateValue('engagement-rate', 0, summary.engagement_percentage || 0, 1000, '%');
  
  // Monetization Eligibility
  const eligibilityElement = document.getElementById('monetization-eligible');
  if (eligibilityElement) {
    eligibilityElement.textContent = summary.is_eligible_for_monetization ? 'Eligible' : 'Not Eligible';
    eligibilityElement.className = summary.is_eligible_for_monetization ? 'eligibility-badge eligible' : 'eligibility-badge not-eligible';
  }
}

// ============================================
// ✅ ANIMATE VALUE (Counter Animation)
// ============================================
function animateValue(elementId, start, end, duration, suffix = '') {
  const element = document.getElementById(elementId);
  if (!element) return;

  const range = end - start;
  const increment = range / (duration / 10);
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if (current >= end) {
      current = end;
      clearInterval(timer);
    }
    
    if (typeof end === 'number') {
      if (Number.isInteger(end)) {
        element.textContent = suffix + Math.round(current).toLocaleString();
      } else {
        element.textContent = suffix + current.toFixed(1);
      }
    }
  }, 10);
}

// ============================================
// ✅ TOP CONTENT TABLE
// ============================================
function updateTopContentTable(content) {
  const tbody = document.getElementById('top-content-body');
  if (!tbody) return;

  if (!content || content.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-8">
          <i class="fas fa-video text-4xl text-gray-500 mb-4"></i>
          <p class="text-gray-400">No content found for this period</p>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  content.forEach((item, index) => {
    const rank = index + 1;
    const thumbnail = item.thumbnail_url || 'https://via.placeholder.com/60x34?text=No+Thumb';
    const title = item.title || 'Untitled';
    const views = item.analytics?.totalViews || 0;
    const uniqueViewers = item.analytics?.uniqueViewers || 0;
    const watchTime = item.analytics?.totalWatchTime || 0;
    const completion = item.analytics?.avgCompletionRate || 0;
    const earnings = views * 0.01; // R0.01 per view

    html += `
      <tr class="hover:bg-gray-800/50 transition-colors">
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="text-sm font-medium text-gray-400">#${rank}</span>
        </td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <img src="${thumbnail}" alt="${title}" class="w-15 h-10 rounded object-cover bg-gray-800" onerror="this.src='https://via.placeholder.com/60x34?text=Error'">
            <span class="text-sm font-medium text-white truncate max-w-[200px]" title="${title}">${title}</span>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
          ${item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
          ${views.toLocaleString()}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
          ${uniqueViewers.toLocaleString()}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
          ${Math.round(watchTime / 60)} min
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
          ${completion.toFixed(1)}%
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
          R${earnings.toFixed(2)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button onclick="viewContentDetails('${item.id}')" class="text-bantu-blue hover:text-bantu-gold transition-colors">
            <i class="fas fa-chart-line mr-1"></i> Details
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// ============================================
// ✅ WATCH TIME CHART
// ============================================
function createWatchTimeChart(data) {
  const ctx = document.getElementById('watchTimeChart')?.getContext('2d');
  if (!ctx) return;

  // Destroy existing chart
  if (charts.watchTime) {
    charts.watchTime.destroy();
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
          },
          title: {
            display: true,
            text: 'Views',
            color: '#94A3B8'
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
          },
          title: {
            display: true,
            text: 'Watch Time (hours)',
            color: '#94A3B8'
          }
        }
      }
    }
  });
}

// ============================================
// ✅ AUDIENCE LOCATIONS
// ============================================
function updateAudienceLocations(locations) {
  const container = document.getElementById('top-locations');
  if (!container) return;

  if (!locations || locations.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-center py-4">No location data available</p>';
    return;
  }

  let html = '';
  locations.slice(0, 5).forEach(loc => {
    html += `
      <div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
        <span class="text-gray-300">
          <i class="fas fa-map-marker-alt text-bantu-gold mr-2"></i>
          ${loc.country}
        </span>
        <span class="text-bantu-gold font-semibold">
          ${loc.percentage}% (${loc.count})
        </span>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ============================================
// ✅ DEVICE BREAKDOWN
// ============================================
function updateDeviceBreakdown(devices) {
  const container = document.getElementById('device-breakdown');
  if (!container) return;

  if (!devices || devices.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-center py-4">No device data available</p>';
    return;
  }

  let html = '';
  devices.forEach(device => {
    const deviceIcon = getDeviceIcon(device.device);
    html += `
      <div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
        <span class="text-gray-300">
          <i class="fas ${deviceIcon} text-bantu-gold mr-2"></i>
          ${device.device}
        </span>
        <span class="text-bantu-gold font-semibold">
          ${device.percentage}% (${device.count})
        </span>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ============================================
// ✅ GET DEVICE ICON
// ============================================
function getDeviceIcon(device) {
  const deviceLower = (device || '').toLowerCase();
  if (deviceLower.includes('mobile') || deviceLower.includes('phone')) {
    return 'fa-mobile-alt';
  } else if (deviceLower.includes('tablet')) {
    return 'fa-tablet-alt';
  } else if (deviceLower.includes('desktop') || deviceLower.includes('pc')) {
    return 'fa-desktop';
  } else {
    return 'fa-laptop';
  }
}

// ============================================
// ✅ VIEW CONTENT DETAILS
// ============================================
function viewContentDetails(contentId) {
  window.location.href = `/creator/content-analytics.html?id=${contentId}`;
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
      
      // Reload data with new time range
      showContentLoading();
      await loadDashboardData();
      hideContentLoading();
    });
  });
}

// ============================================
// ✅ SETUP CONTENT FILTERS
// ============================================
function setupContentFilters() {
  const filterSelect = document.querySelector('.content-filter .filter-select');
  if (!filterSelect) return;

  filterSelect.addEventListener('change', async function() {
    currentSortMetric = this.value;
    
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
// ✅ ✅ NEW: SETUP EXPORT BUTTON
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
      
      // Track export event
      if (window.gtag) {
        window.gtag('event', 'analytics_export', {
          'time_range': timeRange,
          'filename': result.filename
        });
      }
      
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
// ✅ ✅ NEW: DOWNLOAD CSV FILE
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
// ✅ LOADING STATES
// ============================================
function showLoading() {
  document.getElementById('loading-overlay')?.classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay')?.classList.add('hidden');
}

function showContentLoading() {
  document.getElementById('content-loading')?.classList.remove('hidden');
}

function hideContentLoading() {
  document.getElementById('content-loading')?.classList.add('hidden');
}

// ============================================
// ✅ ERROR HANDLING
// ============================================
function showError(message) {
  const errorContainer = document.getElementById('error-container');
  if (errorContainer) {
    errorContainer.classList.remove('hidden');
    errorContainer.querySelector('.error-message').textContent = message;
  }
  
  hideLoading();
  hideContentLoading();
}

// ============================================
// ✅ ✅ NEW: TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
  // Check if toast container exists
  let container = document.querySelector('.toast-container');
  
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Create toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Add icon based on type
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-exclamation-circle';
  if (type === 'warning') icon = 'fa-exclamation-triangle';
  
  toast.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${message}</span>
  `;

  // Add to container
  container.appendChild(toast);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
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
// ✅ PRINT REPORT
// ============================================
function printReport() {
  window.print();
}

// ============================================
// ✅ INITIALIZE ON PAGE LOAD
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on the analytics page
  if (document.getElementById('analytics-dashboard')) {
    initAnalyticsPage();
  }
});

// Make functions available globally
window.viewContentDetails = viewContentDetails;
window.refreshData = refreshData;
window.printReport = printReport;
window.showToast = showToast;
