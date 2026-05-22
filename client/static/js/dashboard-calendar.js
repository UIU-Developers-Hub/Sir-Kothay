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
  if (!grid) return;
  var html = '';
  var dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  for (var i = 0; i < 7; i++) html += '<div class="sk-calendar-head">' + dayHeaders[i] + '</div>';

  var firstDay = new Date(calYear, calMonth, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1;
  var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  var today = new Date();

  for (var b = 0; b < firstDay; b++) html += '<div class="sk-calendar-day muted"></div>';

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

    html += '<div class="sk-calendar-day' + (isToday ? ' today' : '') + '">';
    html += '<div class="sk-calendar-number">' + d + '</div>';

    // Show events (max 2)
    for (var ei = 0; ei < Math.min(dayEvents.length, 2); ei++) {
      var ev = dayEvents[ei];
      html += '<button type="button" onclick="event.stopPropagation(); openEditEventModal(' + ev.id + ');" class="sk-calendar-chip" title="' + escapeHtml(ev.title) + '" style="background:' + (ev.color || '#f68b1f') + '">' +
        '<i class="bi bi-broadcast"></i><span class="truncate">' + escapeHtml(ev.title) + '</span></button>';
    }
    // Show recurring schedules (max 1 if space)
    if (dayScheds.length > 0 && dayEvents.length < 2) {
      var sc = dayScheds[0];
      html += '<div class="sk-calendar-chip recurring" title="Recurring: ' + escapeHtml(sc.message) + '"><i class="bi bi-arrow-repeat"></i><span class="truncate">' + sc.time_of_day.slice(0, 5) + '</span></div>';
    }
    var totalItems = dayEvents.length + dayScheds.length;
    if (totalItems > 2) html += '<div class="sk-calendar-more">+' + (totalItems - 2) + ' more</div>';
    html += '</div>';
  }
  grid.innerHTML = html;
}

function openNewEventModal() {
  document.getElementById('eventModalTitle').textContent = 'New Calendar Event';
  document.getElementById('evtId').value = '';
  document.getElementById('evtTitle').value = '';
  document.getElementById('evtStart').value = '';
  document.getElementById('evtEnd').value = '';
  document.getElementById('evtColor').value = '#f68b1f';
  document.getElementById('evtAvail').value = '';
  document.getElementById('eventModalDelete').classList.add('hidden');
  openModal('addEventModal');
}

function openEditEventModal(id) {
  var ev = calEvents.find(function(e) { return e.id === id; });
  if (!ev) return;
  document.getElementById('eventModalTitle').textContent = 'Edit Calendar Event';
  document.getElementById('evtId').value = ev.id;
  document.getElementById('evtTitle').value = ev.title;
  document.getElementById('evtStart').value = toLocalDateTimeInput(ev.start_time);
  document.getElementById('evtEnd').value = toLocalDateTimeInput(ev.end_time);
  document.getElementById('evtColor').value = ev.color || '#f68b1f';
  document.getElementById('evtAvail').value = ev.set_availability || '';
  document.getElementById('eventModalDelete').classList.remove('hidden');
  openModal('addEventModal');
}

async function submitEvent() {
  var id = document.getElementById('evtId').value;
  var title = document.getElementById('evtTitle').value.trim();
  var startVal = document.getElementById('evtStart').value;
  var endVal = document.getElementById('evtEnd').value;
  var color = document.getElementById('evtColor').value;
  var availChoice = document.getElementById('evtAvail').value;
  if (!title || !startVal || !endVal) { await skNotify('Title, start, and end are required', { variant: 'info', title: 'Calendar' }); return; }
  try {
    var payload = {
      title: title, start_time: new Date(startVal).toISOString(), end_time: new Date(endVal).toISOString(),
      color: color
    };
    if (availChoice) payload.set_availability = availChoice;
    else payload.set_availability = '';
    
    var url = API_ENDPOINTS.CALENDAR_LIST;
    var method = 'POST';
    if (id) {
      url += id + '/';
      method = 'PATCH';
    }
    
    var res = await apiRequest(url, { method: method, body: JSON.stringify(payload) });
    if (res.ok) {
      document.getElementById('evtTitle').value = ''; document.getElementById('evtStart').value = '';
      document.getElementById('evtEnd').value = ''; document.getElementById('evtAvail').value = '';
      closeModal('addEventModal');
      var msg = id ? 'Event updated!' : 'Scheduled broadcast created!';
      await skNotify(msg, { variant: 'success', title: 'Calendar' });
      loadCalendarEvents();
    } else { var d = await res.json(); await skNotify(JSON.stringify(d), { variant: 'error', title: 'Calendar' }); }
  } catch (e) { await skNotify('Failed to save event', { variant: 'error', title: 'Calendar' }); }
}

async function deleteEvent() {
  var id = document.getElementById('evtId').value;
  if (!id) return;
  var ok = await skConfirm('Delete this calendar event?', { title: 'Delete Event', confirmText: 'Delete', danger: true });
  if (!ok) return;
  try {
    var res = await apiRequest(API_ENDPOINTS.CALENDAR_LIST + id + '/', { method: 'DELETE' });
    if (res.ok) {
      closeModal('addEventModal');
      await skNotify('Event deleted!', { variant: 'success', title: 'Calendar' });
      loadCalendarEvents();
    }
  } catch (e) { await skNotify('Failed to delete event', { variant: 'error', title: 'Calendar' }); }
}
