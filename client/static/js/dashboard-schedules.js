/* dashboard-schedules.js — Recurring Schedules (interconnected with Calendar) */

var dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
var dayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Global schedules cache for calendar overlay
window._recurringSchedules = [];

async function loadSchedules() {
  try {
    var res = await apiRequest(API_ENDPOINTS.RECURRING_LIST);
    var data = await res.json();
    window._recurringSchedules = Array.isArray(data) ? data : (data.results || []);
    var el = document.getElementById('schedulesList');
    if (!res.ok) { el.innerHTML = '<p class="text-red-500">Failed to load schedules</p>'; return; }
    var items = window._recurringSchedules;
    if (items.length === 0) {
      el.innerHTML = '<div class="text-center py-10">' +
        '<div class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4"><i class="bi bi-arrow-repeat text-2xl text-indigo-500"></i></div>' +
        '<h3 class="text-gray-700 font-semibold mb-1">Automate Your Status</h3>' +
        '<p class="text-gray-400 text-sm mb-2">Set up recurring rules like "Every Monday at 9am → In a Meeting".<br>These also appear on your <a onclick="document.querySelector(\'[data-tab=calendar]\').click()" class="text-indigo-500 cursor-pointer underline">Calendar</a> view.</p>' +
        '<button onclick="openModal(\'addScheduleModal\')" class="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 transition">Create Your First Schedule</button></div>';
      return;
    }
    el.innerHTML = items.map(function (s) {
      var durText = s.duration_minutes ? (s.duration_minutes < 60 ? s.duration_minutes + 'min' : (s.duration_minutes / 60) + 'h') : '∞';
      var statusDot = s.is_active ? '<span class="w-2 h-2 bg-green-500 rounded-full"></span>' : '<span class="w-2 h-2 bg-gray-300 rounded-full"></span>';
      return '<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-2 hover:shadow-md transition-shadow">' +
        '<div class="flex items-start gap-3 flex-1 min-w-0">' +
        '<div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"><i class="bi bi-arrow-repeat text-indigo-500"></i></div>' +
        '<div class="min-w-0"><div class="flex items-center gap-2">' + statusDot +
        '<p class="font-semibold text-sm text-gray-800">' + (s.day_label || dayNames[s.day_of_week]) + ' at ' + s.time_of_day.slice(0, 5) + '</p></div>' +
        '<p class="text-xs text-gray-500 mt-0.5 truncate">"' + escapeHtml(s.message) + '"</p>' +
        '<p class="text-xs text-gray-400 mt-0.5">Duration: ' + durText + (s.last_triggered_at ? ' · Last ran: ' + timeAgo(s.last_triggered_at) : '') + '</p></div></div>' +
        '<div class="flex gap-1.5 mt-2 sm:mt-0 flex-shrink-0">' +
        '<button onclick="toggleSchedule(' + s.id + ',' + s.is_active + ')" class="text-xs px-3 py-1.5 rounded-lg border transition ' + (s.is_active ? 'border-yellow-200 text-yellow-600 hover:bg-yellow-50' : 'border-green-200 text-green-600 hover:bg-green-50') + '">' + (s.is_active ? '<i class="bi bi-pause-fill"></i> Pause' : '<i class="bi bi-play-fill"></i> Resume') + '</button>' +
        '<button onclick="deleteSchedule(' + s.id + ')" class="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500"><i class="bi bi-trash"></i></button>' +
        '</div></div>';
    }).join('');
  } catch (e) {
    document.getElementById('schedulesList').innerHTML = '<p class="text-red-500">Error loading schedules</p>';
  }
}

async function submitSchedule() {
  var day = parseInt(document.getElementById('schedDay').value);
  var time = document.getElementById('schedTime').value;
  var message = document.getElementById('schedMessage').value.trim();
  var dur = document.getElementById('schedDuration').value;
  var availChoice = document.getElementById('schedAvail').value;
  if (!time || !message) { await skNotify('Please fill day, time, and message', { variant: 'info', title: 'Schedules' }); return; }
  try {
    var payload = { day_of_week: day, time_of_day: time, message: message, duration_minutes: dur ? parseInt(dur) : null };
    if (availChoice) payload.set_availability = availChoice;
    var res = await apiRequest(API_ENDPOINTS.RECURRING_LIST, {
      method: 'POST', body: JSON.stringify(payload)
    });
    if (res.ok) {
      document.getElementById('schedMessage').value = ''; document.getElementById('schedAvail').value = '';
      closeModal('addScheduleModal');
      await skNotify('Schedule created! It will also appear on your Calendar.', { variant: 'success', title: 'Schedules' });
      loadSchedules();
    } else { var d = await res.json(); await skNotify(JSON.stringify(d), { variant: 'error', title: 'Schedules' }); }
  } catch (e) { await skNotify('Failed to create schedule', { variant: 'error', title: 'Schedules' }); }
}

async function toggleSchedule(id, currentActive) {
  try {
    var res = await apiRequest(API_ENDPOINTS.RECURRING_LIST + id + '/', {
      method: 'PATCH', body: JSON.stringify({ is_active: !currentActive })
    });
    if (res.ok) { loadSchedules(); }
  } catch (e) { await skNotify('Failed to update', { variant: 'error', title: 'Schedules' }); }
}

async function deleteSchedule(id) {
  var ok = await skConfirm('Delete this schedule?', { title: 'Delete Schedule', confirmText: 'Delete', danger: true });
  if (!ok) return;
  try {
    var res = await apiRequest(API_ENDPOINTS.RECURRING_LIST + id + '/', { method: 'DELETE' });
    if (res.ok) { await skNotify('Deleted!', { variant: 'success', title: 'Schedules' }); loadSchedules(); }
  } catch (e) { await skNotify('Failed to delete', { variant: 'error', title: 'Schedules' }); }
}
