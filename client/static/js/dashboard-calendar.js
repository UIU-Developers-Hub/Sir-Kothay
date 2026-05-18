/* dashboard-calendar.js — Internal Calendar (shows events + recurring schedules overlay) */

var calYear, calMonth, calEvents = [];
(function () { var n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); })();

function calNavMonth(delta) {
  calMonth += delta;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  loadCalendarEvents();
}

async function loadCalendarEvents() {
  var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent = monthNames[calMonth] + ' ' + calYear;
  var start = new Date(calYear, calMonth, 1).toISOString();
  var end = new Date(calYear, calMonth + 1, 0, 23, 59, 59).toISOString();
  try {
    var res = await apiRequest(API_ENDPOINTS.CALENDAR_LIST + '?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end));
    var data = await res.json();
    calEvents = Array.isArray(data) ? data : (data.results || []);
  } catch (e) { calEvents = []; }
  // Also fetch recurring schedules if not cached
  if (!window._recurringSchedules || !window._recurringSchedules.length) {
    try {
      var sRes = await apiRequest(API_ENDPOINTS.RECURRING_LIST);
      var sData = await sRes.json();
      window._recurringSchedules = Array.isArray(sData) ? sData : (sData.results || []);
    } catch (e) { window._recurringSchedules = []; }
  }
  renderCalendar();
}

function renderCalendar() {
  var grid = document.getElementById('calendarGrid');
  var html = '';
  var dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  for (var i = 0; i < 7; i++) html += '<div class="bg-gray-50 text-center text-xs font-bold py-2.5 text-gray-500 uppercase tracking-wider">' + dayHeaders[i] + '</div>';

  var firstDay = new Date(calYear, calMonth, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1;
  var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  var today = new Date();

  for (var b = 0; b < firstDay; b++) html += '<div class="bg-white p-1.5 min-h-[80px] opacity-30"></div>';

  for (var d = 1; d <= daysInMonth; d++) {
    var isToday = (d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear());
    var dateStr = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var thisDow = new Date(calYear, calMonth, d).getDay();
    thisDow = thisDow === 0 ? 6 : thisDow - 1; // Monday=0

    // Events for this day
    var dayEvents = calEvents.filter(function (ev) {
      return ev.start_time.slice(0, 10) <= dateStr && ev.end_time.slice(0, 10) >= dateStr;
    });

    // Recurring schedules for this weekday
    var dayScheds = (window._recurringSchedules || []).filter(function (s) {
      return s.is_active && s.day_of_week === thisDow;
    });

    html += '<div class="bg-white p-1.5 min-h-[80px] hover:bg-orange-50/50 transition-colors cursor-default' + (isToday ? ' ring-2 ring-orange-400 ring-inset bg-orange-50/30' : '') + '">';
    html += '<div class="text-xs font-semibold mb-0.5 ' + (isToday ? 'text-orange-600' : 'text-gray-600') + '">' + d + '</div>';

    // Show events (max 2)
    for (var ei = 0; ei < Math.min(dayEvents.length, 2); ei++) {
      var ev = dayEvents[ei];
      var hasBroadcast = ev.broadcast_message ? ' title="Auto-sets status: ' + escapeHtml(ev.broadcast_message) + '"' : '';
      html += '<div class="text-[10px] px-1.5 py-0.5 rounded mt-0.5 text-white truncate"' + hasBroadcast + ' style="background:' + (ev.color || '#f68b1f') + '">' +
        (ev.broadcast_message ? '<i class="bi bi-broadcast" style="font-size:8px"></i> ' : '') + escapeHtml(ev.title) + '</div>';
    }
    // Show recurring schedules (max 1 if space)
    if (dayScheds.length > 0 && dayEvents.length < 2) {
      var sc = dayScheds[0];
      html += '<div class="text-[10px] px-1.5 py-0.5 rounded mt-0.5 bg-indigo-100 text-indigo-700 truncate" title="Recurring: ' + escapeHtml(sc.message) + '"><i class="bi bi-arrow-repeat" style="font-size:8px"></i> ' + sc.time_of_day.slice(0, 5) + '</div>';
    }
    var totalItems = dayEvents.length + dayScheds.length;
    if (totalItems > 2) html += '<div class="text-[10px] text-gray-400 mt-0.5">+' + (totalItems - 2) + ' more</div>';
    html += '</div>';
  }
  grid.innerHTML = html;
}

async function submitEvent() {
  var title = document.getElementById('evtTitle').value.trim();
  var startVal = document.getElementById('evtStart').value;
  var endVal = document.getElementById('evtEnd').value;
  var broadcast = document.getElementById('evtBroadcast').value.trim();
  var color = document.getElementById('evtColor').value;
  var availChoice = document.getElementById('evtAvail').value;
  if (!title || !startVal || !endVal) { await skNotify('Title, start, and end are required', { variant: 'info', title: 'Calendar' }); return; }
  try {
    var payload = {
      title: title, start_time: new Date(startVal).toISOString(), end_time: new Date(endVal).toISOString(),
      broadcast_message: broadcast, color: color
    };
    if (availChoice) payload.set_availability = availChoice;
    var res = await apiRequest(API_ENDPOINTS.CALENDAR_LIST, {
      method: 'POST', body: JSON.stringify(payload)
    });
    if (res.ok) {
      document.getElementById('evtTitle').value = ''; document.getElementById('evtStart').value = '';
      document.getElementById('evtEnd').value = ''; document.getElementById('evtBroadcast').value = ''; document.getElementById('evtAvail').value = '';
      closeModal('addEventModal');
      var msg = broadcast ? 'Event created! Your broadcast status will auto-update during this event.' : 'Event created!';
      await skNotify(msg, { variant: 'success', title: 'Calendar' });
      loadCalendarEvents();
    } else { var d = await res.json(); await skNotify(JSON.stringify(d), { variant: 'error', title: 'Calendar' }); }
  } catch (e) { await skNotify('Failed to create event', { variant: 'error', title: 'Calendar' }); }
}
