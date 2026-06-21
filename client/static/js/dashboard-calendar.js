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
  
  var firstDay = new Date(calYear, calMonth, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1;
  var gridStartDate = new Date(calYear, calMonth, 1 - firstDay);
  
  var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  var totalCells = firstDay + daysInMonth;
  var remainingCells = (7 - (totalCells % 7)) % 7;
  var gridEndDate = new Date(calYear, calMonth + 1, remainingCells, 23, 59, 59);

  var start = gridStartDate.toISOString();
  var end = gridEndDate.toISOString();
  
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
  if (typeof _facultyActiveTab === 'function' && _facultyActiveTab() !== 'calendar') {
    calEvents = [];
    window._recurringSchedules = [];
    return;
  }
  renderCalendar();
  if (typeof renderCombinedSchedules === 'function') renderCombinedSchedules();
  
  var dayModal = document.getElementById('dayViewModal');
  if (dayModal && !dayModal.classList.contains('hidden') && window._currentDayModalDate) {
    if (typeof openDayModal === 'function') openDayModal(window._currentDayModalDate);
  }
}

function getDayCellHtml(d, month, year, isMuted) {
  var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  var thisDow = new Date(year, month, d).getDay();
  thisDow = thisDow === 0 ? 6 : thisDow - 1; // Monday=0

  // Events for this day
  var dayEvents = calEvents.filter(function (ev) {
    return ev.is_active !== false && ev.start_time.slice(0, 10) <= dateStr && ev.end_time.slice(0, 10) >= dateStr;
  });

  // Recurring schedules for this weekday
  var dayScheds = (window._recurringSchedules || []).filter(function (s) {
    return s.is_active && s.day_of_week === thisDow;
  });

  var today = new Date();
  var isToday = (d === today.getDate() && month === today.getMonth() && year === today.getFullYear());
  
  var classes = 'sk-calendar-day' + (isToday ? ' today' : '') + (isMuted ? ' muted' : '');
  var html = '<div class="' + classes + ' sk-ex-74fa97c2" onclick="openDayModal(\'' + dateStr + '\')">';
  html += '<div class="sk-calendar-number sk-ex-0b5b3af3"' + (isMuted ? '' : '') + '>' + d + '</div>';

  // Show events (max 2)
  for (var ei = 0; ei < Math.min(dayEvents.length, 2); ei++) {
    var ev = dayEvents[ei];
    html += '<button type="button" onclick="event.stopPropagation(); openEditEventModal(' + ev.id + ');" class="sk-calendar-chip ' + SKDynamicStyles.classFor('background:' + (ev.color || '#f68b1f')) + '" title="' + escapeHtml(ev.title) + '">' +
      '<i class="bi bi-broadcast"></i><span class="truncate">' + escapeHtml(ev.title) + '</span></button>';
  }
  // Show recurring schedules (max 1 if space)
  if (dayScheds.length > 0 && dayEvents.length < 2) {
    var sc = dayScheds[0];
    html += '<button type="button" onclick="event.stopPropagation(); openEditScheduleModalFromList(' + sc.id + ');" class="sk-calendar-chip recurring" title="Recurring: ' + escapeHtml(sc.message) + '"><i class="bi bi-arrow-repeat"></i><span class="truncate">' + sc.time_of_day.slice(0, 5) + '</span></button>';
  }
  var totalItems = dayEvents.length + dayScheds.length;
  if (totalItems > 2) html += '<div class="sk-calendar-more">+' + (totalItems - 2) + ' more</div>';
  html += '</div>';
  return html;
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
  var prevMonthLastDate = new Date(calYear, calMonth, 0);
  var daysInPrevMonth = prevMonthLastDate.getDate();
  var prevMonthY = prevMonthLastDate.getFullYear();
  var prevMonthM = prevMonthLastDate.getMonth();

  for (var b = 0; b < firstDay; b++) {
    var prevD = daysInPrevMonth - firstDay + b + 1;
    html += getDayCellHtml(prevD, prevMonthM, prevMonthY, true);
  }

  for (var d = 1; d <= daysInMonth; d++) {
    html += getDayCellHtml(d, calMonth, calYear, false);
  }

  var totalCells = firstDay + daysInMonth;
  var remainingCells = (7 - (totalCells % 7)) % 7;
  var nextMonthFirstDate = new Date(calYear, calMonth + 1, 1);
  var nextMonthY = nextMonthFirstDate.getFullYear();
  var nextMonthM = nextMonthFirstDate.getMonth();
  for (var aft = 1; aft <= remainingCells; aft++) {
    html += getDayCellHtml(aft, nextMonthM, nextMonthY, true);
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
      if (typeof refreshSidebarInfo === 'function') refreshSidebarInfo();
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
      if (typeof refreshSidebarInfo === 'function') refreshSidebarInfo();
    }
  } catch (e) { await skNotify('Failed to delete', { variant: 'error', title: 'Calendar' }); }
}

async function deleteEventFromList(id) {
  var ok = await skConfirm('Delete this calendar event?', { title: 'Delete Event', confirmText: 'Delete', danger: true });
  if (!ok) return;
  try {
    var res = await apiRequest(API_ENDPOINTS.CALENDAR_LIST + id + '/', { method: 'DELETE' });
    if (res.ok) {
      await skNotify('Event deleted!', { variant: 'success', title: 'Calendar' });
      loadCalendarEvents();
      if (typeof refreshSidebarInfo === 'function') refreshSidebarInfo();
    }
  } catch (e) { await skNotify('Failed to delete', { variant: 'error', title: 'Calendar' }); }
}

async function toggleEvent(id, currentActive) {
  try {
    var res = await apiRequest(API_ENDPOINTS.CALENDAR_LIST + id + '/', {
      method: 'PATCH', body: JSON.stringify({ is_active: !currentActive })
    });
    if (res.ok) {
      loadCalendarEvents();
      if (typeof refreshSidebarInfo === 'function') refreshSidebarInfo();
    }
  } catch (e) { await skNotify('Failed to update', { variant: 'error', title: 'Calendar' }); }
}

function openDayModal(dateStr) {
  if (event) event.stopPropagation();
  window._currentDayModalDate = dateStr;
  var dObj = new Date(dateStr + 'T00:00:00');
  var thisDow = dObj.getDay() || 7;
  var serverDow = thisDow - 1;

  var dayEvents = calEvents.filter(function(e) {
    return e.start_time.slice(0, 10) <= dateStr && e.end_time.slice(0, 10) >= dateStr;
  });

  var dayScheds = (window._recurringSchedules || []).filter(function(s) {
    return s.day_of_week === serverDow;
  });

  var titleEl = document.getElementById('dayViewModalTitle');
  if (titleEl) {
    titleEl.textContent = 'Events on ' + dObj.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  }

  var listEl = document.getElementById('dayViewList');
  if (!listEl) return;

  if (dayEvents.length === 0 && dayScheds.length === 0) {
    listEl.innerHTML = '<div class="sk-empty-state compact"><div class="sk-empty-icon"><i class="bi bi-calendar-x"></i></div><h3>No events or schedules</h3></div>';
    openModal('dayViewModal');
    return;
  }

  var html = '';

  // 1. Recurring Schedules
  html += dayScheds.map(function (s) {
    var durText = formatDurationSeconds(s.duration_seconds);
    var isActive = s.is_active !== false;
    var activeClass = isActive ? 'active' : 'paused';
    return '<div class="sk-schedule-item">' +
      '<div class="sk-schedule-main">' +
      '<div class="sk-schedule-icon ' + activeClass + '"><i class="bi bi-arrow-repeat"></i></div>' +
      '<div class="sk-schedule-copy">' +
      '<div class="sk-schedule-title"><span class="sk-status-dot ' + activeClass + '"></span>' + escapeHtml(s.day_label || dayNames[s.day_of_week]) + ' at ' + escapeHtml(s.time_of_day.slice(0, 5)) + '</div>' +
      '<div class="sk-schedule-message">' + escapeHtml(s.message) + '</div>' +
      '<div class="sk-schedule-meta">Duration: ' + escapeHtml(durText) + (s.last_triggered_at ? ' &middot; Last ran: ' + escapeHtml(timeAgo(s.last_triggered_at)) : '') + '</div>' +
      '</div></div>' +
      '<div class="sk-schedule-actions">' +
      '<button type="button" onclick="toggleSchedule(' + s.id + ',' + isActive + ')" class="sk-btn sk-btn-secondary sk-btn-sm">' + (isActive ? '<i class="bi bi-pause-fill"></i> Pause' : '<i class="bi bi-play-fill"></i> Resume') + '</button>' +
      '<button type="button" onclick="openEditScheduleModalFromList(' + s.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon" title="Edit schedule"><i class="bi bi-pencil"></i></button>' +
      '<button type="button" onclick="deleteSchedule(' + s.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Delete schedule"><i class="bi bi-trash"></i></button>' +
      '</div></div>';
  }).join('');

  // 2. Calendar Events
  html += dayEvents.map(function (e) {
    var startDate = new Date(e.start_time);
    var startStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    var timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    var endDateStr = new Date(e.end_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    var isActive = e.is_active !== false;
    var activeClass = isActive ? 'active' : 'paused';
    var iconBg = isActive ? (e.color || '#f68b1f') : 'transparent';
    var iconColor = isActive ? 'white' : (e.color || '#f68b1f');
    var iconBorder = isActive ? 'none' : ('1px solid ' + (e.color || '#f68b1f'));

    return '<div class="sk-schedule-item">' +
      '<div class="sk-schedule-main">' +
      '<div class="sk-schedule-icon ' + activeClass + ' ' + SKDynamicStyles.classFor('background: ' + iconBg + '; color: ' + iconColor + '; border: ' + iconBorder) + '"><i class="bi bi-calendar-event"></i></div>' +
      '<div class="sk-schedule-copy">' +
      '<div class="sk-schedule-title"><span class="sk-status-dot ' + activeClass + (isActive ? ' ' + SKDynamicStyles.classFor('background: ' + (e.color || '#f68b1f')) : '') + '"></span>' + escapeHtml(startStr) + ' at ' + escapeHtml(timeStr) + '</div>' +
      '<div class="sk-schedule-message">' + escapeHtml(e.title) + '</div>' +
      '<div class="sk-schedule-meta">Ends: ' + escapeHtml(endDateStr) + '</div>' +
      '</div></div>' +
      '<div class="sk-schedule-actions">' +
      '<button type="button" onclick="toggleEvent(' + e.id + ',' + isActive + ')" class="sk-btn sk-btn-secondary sk-btn-sm">' + (isActive ? '<i class="bi bi-pause-fill"></i> Pause' : '<i class="bi bi-play-fill"></i> Resume') + '</button>' +
      '<button type="button" onclick="openEditEventModal(' + e.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon" title="Edit event"><i class="bi bi-pencil"></i></button>' +
      '<button type="button" onclick="deleteEventFromList(' + e.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Delete event"><i class="bi bi-trash"></i></button>' +
      '</div></div>';
  }).join('');

  listEl.innerHTML = html;
  openModal('dayViewModal');
}
