/* dashboard-schedules.js — Recurring Schedules (interconnected with Calendar) */

var dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
var dayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Global schedules cache for calendar overlay
window._recurringSchedules = [];

async function loadSchedules() {
  var el = document.getElementById('schedulesList');
  try {
    var res = await apiRequest(API_ENDPOINTS.RECURRING_LIST);
    var data = await res.json();
    if (typeof _facultyActiveTab === 'function' && _facultyActiveTab() !== 'calendar') return;
    window._recurringSchedules = Array.isArray(data) ? data : (data.results || []);
    renderCombinedSchedules();
    if (typeof renderCalendar === 'function') renderCalendar();
    
    var dayModal = document.getElementById('dayViewModal');
    if (dayModal && !dayModal.classList.contains('hidden') && window._currentDayModalDate) {
      if (typeof openDayModal === 'function') openDayModal(window._currentDayModalDate);
    }
  } catch (e) {
    if (el) el.innerHTML = '<div class="sk-empty-state compact"><div class="sk-empty-icon error"><i class="bi bi-exclamation-triangle"></i></div><h3>Error loading schedules</h3></div>';
  }
}

function renderCombinedSchedules() {
  var el = document.getElementById('schedulesList');
  if (!el) return;

  var filterVal = 'upcoming7';
  var filterEl = document.getElementById('scheduleTimeFilter');
  if (filterEl) filterVal = filterEl.value;

  var typeFilterVal = 'all';
  var typeFilterEl = document.getElementById('scheduleTypeFilter');
  if (typeFilterEl) typeFilterVal = typeFilterEl.value;

  var statusFilterVal = 'all';
  var statusFilterEl = document.getElementById('scheduleStatusFilter');
  if (statusFilterEl) statusFilterVal = statusFilterEl.value;

  var recItems = window._recurringSchedules || [];
  var calItems = typeof calEvents !== 'undefined' ? calEvents : [];

  var now = new Date();
  
  // Filter Calendar Events
  var filteredEvents = [];
  if (typeFilterVal === 'all' || typeFilterVal === 'calendar') {
    filteredEvents = calItems.filter(function(e) {
      var isActive = e.is_active !== false;
      if (statusFilterVal === 'active' && !isActive) return false;
      if (statusFilterVal === 'paused' && isActive) return false;

      var end = new Date(e.end_time);
      var start = new Date(e.start_time);
      
      if (filterVal === 'upcoming') return end >= now;
      if (filterVal === 'upcoming7') {
        var up7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return end >= now && start <= up7;
      }
      if (filterVal === 'upcoming30') {
        var up30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return end >= now && start <= up30;
      }
      if (filterVal === 'today') {
        var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return (start <= endOfToday && end >= startOfToday);
      }
      if (filterVal === 'last7') {
        var last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return end >= last7 && end <= now;
      }
      if (filterVal === 'last30') {
        var last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return end >= last30 && end <= now;
      }
      return true; // all
    });
  }
  
  // Filter Recurring Schedules
  var filteredRecs = [];
  if (typeFilterVal === 'all' || typeFilterVal === 'recurring') {
    filteredRecs = recItems.filter(function(s) {
      if (statusFilterVal === 'active' && !s.is_active) return false;
      if (statusFilterVal === 'paused' && s.is_active) return false;

      if (filterVal === 'today') {
        var todayIsoDow = now.getDay() || 7; // 1-7
        var serverDow = todayIsoDow - 1; // 0-6 (0=Mon, 6=Sun)
        return s.day_of_week === serverDow;
      }
      return true; // other time filters don't really apply to infinite recurring rules
    });
  }

  filteredEvents.sort(function(a, b) { return a.start_time.localeCompare(b.start_time); });

  if (filteredRecs.length === 0 && filteredEvents.length === 0) {
    el.innerHTML = '<div class="sk-empty-state compact">' +
      '<div class="sk-empty-icon"><i class="bi bi-calendar-x"></i></div>' +
      '<h3>No schedules match the filter</h3>' +
      '</div>';
    return;
  }

  var html = '<div class="sk-schedule-list">';

  // 1. Recurring Schedules
  html += filteredRecs.map(function (s) {
    var durText = formatDurationSeconds(s.duration_seconds);
    var activeClass = s.is_active ? 'active' : 'paused';
    return '<div class="sk-schedule-item">' +
      '<div class="sk-schedule-main">' +
      '<div class="sk-schedule-icon ' + activeClass + '"><i class="bi bi-arrow-repeat"></i></div>' +
      '<div class="sk-schedule-copy">' +
      '<div class="sk-schedule-title"><span class="sk-status-dot ' + activeClass + '"></span>' + escapeHtml(s.day_label || dayNames[s.day_of_week]) + ' at ' + escapeHtml(s.time_of_day.slice(0, 5)) + '</div>' +
      '<div class="sk-schedule-message">' + escapeHtml(s.message) + '</div>' +
      '<div class="sk-schedule-meta">Duration: ' + escapeHtml(durText) + (s.last_triggered_at ? ' &middot; Last ran: ' + escapeHtml(timeAgo(s.last_triggered_at)) : '') + '</div>' +
      '</div></div>' +
      '<div class="sk-schedule-actions">' +
      '<button onclick="toggleSchedule(' + s.id + ',' + s.is_active + ')" class="sk-btn sk-btn-secondary sk-btn-sm">' + (s.is_active ? '<i class="bi bi-pause-fill"></i> Pause' : '<i class="bi bi-play-fill"></i> Resume') + '</button>' +
      '<button onclick="openEditScheduleModalFromList(' + s.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon" title="Edit schedule"><i class="bi bi-pencil"></i></button>' +
      '<button onclick="deleteSchedule(' + s.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Delete schedule"><i class="bi bi-trash"></i></button>' +
      '</div></div>';
  }).join('');

  // 2. Calendar Events
  html += filteredEvents.map(function (e) {
    var startDate = new Date(e.start_time);
    var dateStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    var timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    var endDateStr = new Date(e.end_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    var isActive = e.is_active !== false;
    var activeClass = isActive ? 'active' : 'paused';
    var iconBg = isActive ? (e.color || '#f68b1f') : 'transparent';
    var iconColor = isActive ? 'white' : (e.color || '#f68b1f');
    var iconBorder = isActive ? 'none' : ('1px solid ' + (e.color || '#f68b1f'));

    return '<div class="sk-schedule-item">' +
      '<div class="sk-schedule-main">' +
      '<div class="sk-schedule-icon ' + activeClass + '" style="background: ' + iconBg + '; color: ' + iconColor + '; border: ' + iconBorder + '"><i class="bi bi-calendar-event"></i></div>' +
      '<div class="sk-schedule-copy">' +
      '<div class="sk-schedule-title"><span class="sk-status-dot ' + activeClass + '" style="' + (isActive ? 'background: ' + (e.color || '#f68b1f') : '') + '"></span>' + escapeHtml(dateStr) + ' at ' + escapeHtml(timeStr) + '</div>' +
      '<div class="sk-schedule-message">' + escapeHtml(e.title) + '</div>' +
      '<div class="sk-schedule-meta">Ends: ' + escapeHtml(endDateStr) + '</div>' +
      '</div></div>' +
      '<div class="sk-schedule-actions">' +
      '<button onclick="toggleEvent(' + e.id + ',' + isActive + ')" class="sk-btn sk-btn-secondary sk-btn-sm">' + (isActive ? '<i class="bi bi-pause-fill"></i> Pause' : '<i class="bi bi-play-fill"></i> Resume') + '</button>' +
      '<button onclick="openEditEventModal(' + e.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon" title="Edit event"><i class="bi bi-pencil"></i></button>' +
      '<button onclick="deleteEventFromList(' + e.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Delete event"><i class="bi bi-trash"></i></button>' +
      '</div></div>';
  }).join('');

  html += '</div>';
  el.innerHTML = html;
}

function openEditScheduleModalFromList(id) {
  var s = (window._recurringSchedules || []).find(function (item) { return item.id === id; });
  if (!s) return;
  openEditScheduleModal(s.id, s.message, s.day_of_week, s.time_of_day.slice(0, 5), s.duration_seconds || '', s.set_availability || '');
}

function formatDurationSeconds(seconds) {
  if (!seconds) return 'No expiry';
  if (seconds % 86400 === 0) return (seconds / 86400) + ' day' + (seconds / 86400 === 1 ? '' : 's');
  if (seconds % 3600 === 0) return (seconds / 3600) + ' hr';
  if (seconds % 60 === 0) return (seconds / 60) + ' min';
  return seconds + ' sec';
}

function openNewScheduleModal() {
  document.getElementById('scheduleModalTitle').textContent = 'New Recurring Schedule';
  document.getElementById('schedId').value = '';
  document.getElementById('schedDay').value = '0';
  document.getElementById('schedTime').value = '';
  document.getElementById('schedMessage').value = '';
  document.getElementById('schedDuration').value = '';
  document.getElementById('schedDurationUnit').value = '60';
  document.getElementById('schedAvail').value = '';
  openModal('addScheduleModal');
}

function openEditScheduleModal(id, message, day, time, dur, avail) {
  document.getElementById('scheduleModalTitle').textContent = 'Edit Recurring Schedule';
  document.getElementById('schedId').value = id;
  document.getElementById('schedDay').value = day;
  document.getElementById('schedTime').value = time;
  document.getElementById('schedMessage').value = message;
  if (dur) {
    var durInt = parseInt(dur);
    if (durInt % 86400 === 0) {
      document.getElementById('schedDuration').value = durInt / 86400;
      document.getElementById('schedDurationUnit').value = '86400';
    } else if (durInt % 3600 === 0) {
      document.getElementById('schedDuration').value = durInt / 3600;
      document.getElementById('schedDurationUnit').value = '3600';
    } else if (durInt % 60 === 0) {
      document.getElementById('schedDuration').value = durInt / 60;
      document.getElementById('schedDurationUnit').value = '60';
    } else {
      document.getElementById('schedDuration').value = durInt;
      document.getElementById('schedDurationUnit').value = '1';
    }
  } else {
    document.getElementById('schedDuration').value = '';
    document.getElementById('schedDurationUnit').value = '60';
  }
  document.getElementById('schedAvail').value = avail;
  openModal('addScheduleModal');
}

async function submitSchedule() {
  var id = document.getElementById('schedId').value;
  var day = parseInt(document.getElementById('schedDay').value);
  var time = document.getElementById('schedTime').value;
  var message = document.getElementById('schedMessage').value.trim();
  var dur = document.getElementById('schedDuration').value;
  var availChoice = document.getElementById('schedAvail').value;
  if (!time || !message) { await skNotify('Please fill day, time, and message', { variant: 'info', title: 'Schedules' }); return; }
  try {
    var totalDur = dur ? parseInt(dur) * parseInt(document.getElementById('schedDurationUnit').value) : null;
    var payload = { day_of_week: day, time_of_day: time, message: message, duration_seconds: totalDur };
    if (availChoice) payload.set_availability = availChoice;
    else payload.set_availability = '';
    
    var url = API_ENDPOINTS.RECURRING_LIST;
    var method = 'POST';
    if (id) {
      url += id + '/';
      method = 'PATCH';
    }
    
    var res = await apiRequest(url, { method: method, body: JSON.stringify(payload) });
    if (res.ok) {
      closeModal('addScheduleModal');
      await skNotify(id ? 'Schedule updated!' : 'Schedule created! It will also appear on your Calendar.', { variant: 'success', title: 'Schedules' });
      loadSchedules();
      if (typeof loadCalendarEvents === 'function') loadCalendarEvents();
      if (typeof refreshSidebarInfo === 'function') refreshSidebarInfo();
    } else { var d = await res.json(); await skNotify(JSON.stringify(d), { variant: 'error', title: 'Schedules' }); }
  } catch (e) { await skNotify('Failed to save schedule', { variant: 'error', title: 'Schedules' }); }
}

async function toggleSchedule(id, currentActive) {
  try {
    var res = await apiRequest(API_ENDPOINTS.RECURRING_LIST + id + '/', {
      method: 'PATCH', body: JSON.stringify({ is_active: !currentActive })
    });
    if (res.ok) {
      loadSchedules();
      if (typeof loadCalendarEvents === 'function') loadCalendarEvents();
      if (typeof refreshSidebarInfo === 'function') refreshSidebarInfo();
    }
  } catch (e) { await skNotify('Failed to update', { variant: 'error', title: 'Schedules' }); }
}

async function deleteSchedule(id) {
  var ok = await skConfirm('Delete this schedule?', { title: 'Delete Schedule', confirmText: 'Delete', danger: true });
  if (!ok) return;
  try {
    var res = await apiRequest(API_ENDPOINTS.RECURRING_LIST + id + '/', { method: 'DELETE' });
    if (res.ok) {
      await skNotify('Deleted!', { variant: 'success', title: 'Schedules' });
      loadSchedules();
      if (typeof loadCalendarEvents === 'function') loadCalendarEvents();
      if (typeof refreshSidebarInfo === 'function') refreshSidebarInfo();
    }
  } catch (e) { await skNotify('Failed to delete', { variant: 'error', title: 'Schedules' }); }
}
