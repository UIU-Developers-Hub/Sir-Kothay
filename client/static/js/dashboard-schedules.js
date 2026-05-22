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
    window._recurringSchedules = Array.isArray(data) ? data : (data.results || []);
    if (!el) {
      if (typeof renderCalendar === 'function') renderCalendar();
      return;
    }
    if (!res.ok) {
      el.innerHTML = '<div class="sk-empty-state compact"><div class="sk-empty-icon error"><i class="bi bi-exclamation-triangle"></i></div><h3>Failed to load schedules</h3></div>';
      return;
    }
    var items = window._recurringSchedules;
    if (items.length === 0) {
      el.innerHTML = '<div class="sk-empty-state compact">' +
        '<div class="sk-empty-icon"><i class="bi bi-arrow-repeat"></i></div>' +
        '<h3>No recurring schedules</h3>' +
        '<button onclick="openNewScheduleModal()" class="sk-btn sk-btn-primary sk-btn-sm"><i class="bi bi-plus-lg"></i> Create Schedule</button>' +
        '</div>';
      if (typeof renderCalendar === 'function') renderCalendar();
      return;
    }
    el.innerHTML = '<div class="sk-schedule-list">' + items.map(function (s) {
      var durText = formatDurationSeconds(s.duration_seconds);
      var activeClass = s.is_active ? 'active' : 'paused';
      return '<div class="sk-schedule-item">' +
        '<div class="sk-schedule-main">' +
        '<div class="sk-schedule-icon ' + activeClass + '"><i class="bi bi-arrow-repeat"></i></div>' +
        '<div class="sk-schedule-copy">' +
        '<div class="sk-schedule-title"><span class="sk-status-dot ' + activeClass + '"></span>' + escapeHtml(s.day_label || dayNames[s.day_of_week]) + ' at ' + escapeHtml(s.time_of_day.slice(0, 5)) + '</div>' +
        '<div class="sk-schedule-message">' + escapeHtml(s.message) + '</div>' +
        '<div class="sk-schedule-meta">Duration: ' + escapeHtml(durText) + (s.last_triggered_at ? ' · Last ran: ' + escapeHtml(timeAgo(s.last_triggered_at)) : '') + '</div>' +
        '</div></div>' +
        '<div class="sk-schedule-actions">' +
        '<button onclick="toggleSchedule(' + s.id + ',' + s.is_active + ')" class="sk-btn sk-btn-secondary sk-btn-sm">' + (s.is_active ? '<i class="bi bi-pause-fill"></i> Pause' : '<i class="bi bi-play-fill"></i> Resume') + '</button>' +
        '<button onclick="openEditScheduleModalFromList(' + s.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon" title="Edit schedule"><i class="bi bi-pencil"></i></button>' +
        '<button onclick="deleteSchedule(' + s.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Delete schedule"><i class="bi bi-trash"></i></button>' +
        '</div></div>';
    }).join('') + '</div>';
    if (typeof renderCalendar === 'function') renderCalendar();
  } catch (e) {
    if (el) el.innerHTML = '<div class="sk-empty-state compact"><div class="sk-empty-icon error"><i class="bi bi-exclamation-triangle"></i></div><h3>Error loading schedules</h3></div>';
  }
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
    }
  } catch (e) { await skNotify('Failed to delete', { variant: 'error', title: 'Schedules' }); }
}
