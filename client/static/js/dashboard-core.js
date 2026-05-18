/* dashboard-core.js — Auth, profile, QR, broadcast messages, modals, tabs */

function checkAuth() {
  if (!localStorage.getItem('access_token')) { window.location.href = '../auth/login.html'; return false; }
  return true;
}
function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '../auth/login.html';
}
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function toApiDateTime(v) { return v ? new Date(v).toISOString() : null; }
function toLocalDateTimeInput(v) {
  if (!v) return '';
  var d = new Date(v); if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function timeAgo(dateStr) {
  var d = new Date(dateStr); var now = new Date(); var diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now'; if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago'; return Math.floor(diff/86400) + 'd ago';
}

// --- Global templates cache for interconnection ---
window._quickTemplates = [];

// Tabs
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); b.classList.add('text-gray-500'); });
      btn.classList.add('active'); btn.classList.remove('text-gray-500');
      document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.add('hidden'); });
      var target = document.getElementById('tab-' + btn.dataset.tab);
      if (target) target.classList.remove('hidden');
      var tab = btn.dataset.tab;
      if (tab === 'templates') loadTemplates();
      else if (tab === 'schedules') loadSchedules();
      else if (tab === 'calendar') { loadCalendarEvents(); }
      else if (tab === 'inbox') loadInbox();
      else if (tab === 'analytics') loadAnalytics();
    });
  });
});

// --- Profile & Dashboard Load ---
var userSlug = null;

async function loadDashboard() {
  if (!checkAuth()) return;
  try {
    var res = await apiRequest(API_ENDPOINTS.USER_DETAILS);
    var data = await res.json();
    if (res.ok) {
      document.getElementById('userName').textContent = data.user_username || 'User';
      document.getElementById('userEmail').textContent = data.user_email || '';
      document.getElementById('userPhone').textContent = data.phone_number || '';
      document.getElementById('userOrg').textContent = data.organization || 'N/A';
      if (data.profile_image) document.getElementById('userImage').src = API_BASE_URL + data.profile_image;
      if (data.default_status) document.getElementById('defaultStatusInput').value = data.default_status;
      userSlug = data.slug;
      updateAvailabilityUI(data.is_available);
      document.getElementById('loadingState').classList.add('hidden');
      document.getElementById('mainContent').classList.remove('hidden');
      loadQRCode(); loadMessages(); loadUnreadCount();
      // Pre-fetch templates for the Add Message interconnection
      prefetchTemplates();
    } else { throw new Error(data.detail || 'Failed to load'); }
  } catch (e) {
    console.error('Dashboard Load Error:', e);
    await skNotify('Failed to load dashboard. Please login again.', { variant: 'error', title: 'Dashboard error' });
    logout();
  }
}

async function saveDefaultStatus() {
  var val = document.getElementById('defaultStatusInput').value.trim();
  try {
    var res = await apiRequest(API_ENDPOINTS.UPDATE_USER_DETAILS, {
      method: 'PATCH', body: JSON.stringify({ default_status: val })
    });
    if (res.ok) await skNotify('Fallback status saved! This message appears when a timed status expires.', { variant: 'success', title: 'Fallback Status' });
    else await skNotify('Failed to save', { variant: 'error', title: 'Settings' });
  } catch (e) { await skNotify('Error saving default status', { variant: 'error', title: 'Settings' }); }
}

// --- Availability Toggle ---
var _isAvailable = false;
function updateAvailabilityUI(available) {
  _isAvailable = !!available;
  var btn = document.getElementById('availabilityToggle');
  var dot = document.getElementById('availDot');
  var label = document.getElementById('availLabel');
  if (_isAvailable) {
    btn.className = 'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-sm bg-green-100 text-green-800 border border-green-300 hover:bg-green-200';
    dot.className = 'w-3 h-3 rounded-full bg-green-500 animate-pulse';
    label.textContent = 'Available';
  } else {
    btn.className = 'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100';
    dot.className = 'w-3 h-3 rounded-full bg-red-400';
    label.textContent = 'Unavailable';
  }
}
async function toggleAvailability() {
  var newVal = !_isAvailable;
  try {
    var res = await apiRequest(API_ENDPOINTS.UPDATE_USER_DETAILS, {
      method: 'PATCH', body: JSON.stringify({ is_available: newVal })
    });
    if (res.ok) {
      updateAvailabilityUI(newVal);
      if (newVal) {
        await skNotify('You are now Available! Subscribers have been notified.', { variant: 'success', title: 'Availability' });
      } else {
        await skNotify('You are now Unavailable.', { variant: 'info', title: 'Availability' });
      }
    } else { await skNotify('Failed to update availability', { variant: 'error', title: 'Availability' }); }
  } catch (e) { await skNotify('Error updating availability', { variant: 'error', title: 'Availability' }); }
}

// Reusable: set availability silently (called from other modules)
async function setAvailability(isAvail) {
  try {
    var res = await apiRequest(API_ENDPOINTS.UPDATE_USER_DETAILS, {
      method: 'PATCH', body: JSON.stringify({ is_available: isAvail })
    });
    if (res.ok) updateAvailabilityUI(isAvail);
  } catch (e) { /* silent */ }
}

// --- Pre-fetch templates for interconnection ---
async function prefetchTemplates() {
  try {
    var res = await apiRequest(API_ENDPOINTS.TEMPLATES_LIST);
    var data = await res.json();
    window._quickTemplates = Array.isArray(data) ? data : (data.results || []);
    renderTemplateQuickPicks();
  } catch (e) { window._quickTemplates = []; }
}

function renderTemplateQuickPicks() {
  var el = document.getElementById('templateQuickPicks');
  if (!el || window._quickTemplates.length === 0) {
    if (el) el.innerHTML = '<p class="text-xs text-gray-400 italic">No quick templates yet. <a onclick="document.querySelector(\'[data-tab=templates]\').click()" class="text-orange-500 cursor-pointer underline">Create one →</a></p>';
    return;
  }
  el.innerHTML = '<p class="text-xs text-gray-500 mb-1.5">Or quick-fill from a template:</p>' +
    window._quickTemplates.map(function (t) {
      return '<button onclick="fillFromTemplate(\'' + escapeHtml(t.message).replace(/'/g, "\\'") + '\')" ' +
        'class="text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2.5 py-1 rounded-full hover:bg-orange-100 transition mr-1 mb-1">' +
        '<i class="bi ' + escapeHtml(t.icon || 'bi-lightning-fill') + ' mr-0.5"></i>' + escapeHtml(t.label) + '</button>';
    }).join('');
}

function fillFromTemplate(msg) {
  document.getElementById('newMessageText').value = msg;
}

// --- QR ---
var qrCodeUrl = null;
async function loadQRCode() {
  try {
    var res = await apiRequest(API_BASE_URL + '/api/qrcode/qrcodes/my_qrcode/');
    var data = await res.json();
    if (res.ok && data.image) {
      qrCodeUrl = API_BASE_URL + data.image;
      document.getElementById('qrCode').src = qrCodeUrl;
      document.getElementById('qrActionBtn').textContent = 'Download';
      document.getElementById('qrActionBtn').onclick = function () { openModal('downloadModal'); };
    }
  } catch (e) { console.log('No QR code found'); }
}
async function handleQRAction() {
  if (document.getElementById('qrActionBtn').textContent === 'Download') openModal('downloadModal');
  else await generateQRCode();
}
async function generateQRCode() {
  var btn = document.getElementById('qrActionBtn');
  btn.disabled = true; btn.textContent = 'Generating...';
  try {
    var res = await apiRequest(API_BASE_URL + '/api/qrcode/qrcodes/generate/', { method: 'POST' });
    if (res.ok) { await skNotify('QR Code generated!', { variant: 'success', title: 'QR code' }); btn.disabled = false; await loadQRCode(); }
    else { var d = await res.json(); await skNotify(d.message || 'Failed', { variant: 'error', title: 'QR code' }); btn.disabled = false; btn.textContent = 'Generate'; }
  } catch (e) { await skNotify('Failed to generate QR code', { variant: 'error', title: 'QR code' }); btn.disabled = false; btn.textContent = 'Generate'; }
}
function downloadQROnly() {
  if (qrCodeUrl) { var a = document.createElement('a'); a.href = qrCodeUrl; a.download = 'my-qr-code.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a); closeModal('downloadModal'); }
}
async function downloadQRWithInfo() {
  if (!qrCodeUrl) return;
  try {
    var r = await apiFetchImage(API_ENDPOINTS.QR_PNG_EXPORT);
    if (!r.ok) throw new Error('QR HTTP ' + r.status);
    var blob = await r.blob(); var img = await createImageBitmap(blob);
    var canvas = document.createElement('canvas'); var ctx = canvas.getContext('2d');
    canvas.width = 600; canvas.height = 700;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 600, 700);
    var g = ctx.createLinearGradient(0, 0, 600, 0); g.addColorStop(0, '#f68b1f'); g.addColorStop(1, '#f68b1f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 600, 120);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 32px Poppins, Arial'; ctx.textAlign = 'center';
    ctx.fillText(document.getElementById('userName').textContent, 300, 70);
    ctx.drawImage(img, 150, 150, 300, 300);
    ctx.fillStyle = '#4b5563'; ctx.font = '600 17px Poppins, Arial';
    ctx.fillText('Scan QR code to know where I am', 300, 490);
    ctx.fillStyle = '#333'; ctx.font = 'bold 18px Poppins, Arial'; ctx.textAlign = 'left';
    ctx.fillText('Email: ' + document.getElementById('userEmail').textContent, 50, 540);
    ctx.fillText('Phone: ' + document.getElementById('userPhone').textContent, 50, 580);
    ctx.fillText('Organization: ' + document.getElementById('userOrg').textContent, 50, 620);
    ctx.fillStyle = '#f68b1f'; ctx.font = 'bold 16px Poppins, Arial'; ctx.textAlign = 'center';
    ctx.fillText('Sir Kothay - Stay Connected', 300, 670);
    canvas.toBlob(function (b) {
      var u = URL.createObjectURL(b); var a = document.createElement('a'); a.href = u; a.download = 'qr-code-with-info.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); closeModal('downloadModal');
    }, 'image/png');
    img.close();
  } catch (e) { await skNotify('Could not build image: ' + e.message, { variant: 'error', title: 'QR code' }); }
}

function viewBroadcastPage() {
  if (userSlug) window.open('../broadcast/message.html?user=' + userSlug, '_blank');
  else skNotify('User slug not available.', { variant: 'error', title: 'Broadcast link' });
}

// --- Broadcast Status Messages ---
function renderStatusBadge(msg) {
  if (msg.active) {
    var untilText = msg.active_until ? ' · expires ' + timeAgo(msg.active_until) : '';
    return '<span class="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>Live' + untilText + '</span>';
  }
  if (msg.scheduled_for) {
    return '<span class="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full"><i class="bi bi-clock"></i>Scheduled · ' + new Date(msg.scheduled_for).toLocaleString() + '</span>';
  }
  return '<span class="text-xs text-gray-400">Inactive</span>';
}

async function loadMessages() {
  try {
    var res = await apiRequest(API_ENDPOINTS.MESSAGES); var data = await res.json();
    var el = document.getElementById('messagesList');
    if (data && data.length > 0) {
      el.innerHTML = data.map(function (msg) {
        var durLabel = msg.duration_minutes ? (msg.duration_minutes < 60 ? msg.duration_minutes + ' min' : (msg.duration_minutes / 60) + 'h') : '∞';
        return '<div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-2 hover:shadow-md transition-shadow">' +
          '<div class="flex-1 min-w-0"><p class="text-gray-800 font-medium text-sm leading-relaxed">' + escapeHtml(msg.message) + '</p>' +
          '<div class="flex flex-wrap items-center gap-2 mt-2">' + renderStatusBadge(msg) +
          '<span class="text-xs text-gray-400"><i class="bi bi-hourglass-split mr-0.5"></i>' + durLabel + '</span></div></div>' +
          '<div class="flex gap-1.5 flex-shrink-0">' +
          '<button onclick="toggleMsg(' + msg.id + ')" class="text-xs px-3 py-1.5 rounded-lg border transition ' + (msg.active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50') + '">' + (msg.active ? '<i class="bi bi-pause-fill"></i> Stop' : '<i class="bi bi-play-fill"></i> Go Live') + '</button>' +
          '<button onclick="openEditModal(' + msg.id + ',\'' + escapeHtml(msg.message).replace(/'/g, "\\'") + '\',' + (msg.scheduled_for ? "'" + msg.scheduled_for + "'" : 'null') + ',' + (msg.duration_minutes || 'null') + ')" class="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><i class="bi bi-pencil"></i></button>' +
          '<button onclick="confirmDeleteMsg(' + msg.id + ')" class="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500"><i class="bi bi-trash"></i></button>' +
          '</div></div>';
      }).join('');
    } else {
      el.innerHTML = '<div class="text-center py-12"><div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4"><i class="bi bi-broadcast text-2xl text-orange-500"></i></div>' +
        '<h3 class="text-gray-700 font-semibold mb-1">No broadcast status yet</h3>' +
        '<p class="text-gray-400 text-sm mb-4">Create your first status to let people know where you are.</p>' +
        '<button onclick="openModal(\'addMessageModal\')" class="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm hover:bg-orange-600 transition">Create Your First Status</button></div>';
    }
  } catch (e) { document.getElementById('messagesList').innerHTML = '<p class="text-red-500 text-center py-8">Failed to load messages</p>'; }
}

async function submitNewMessage() {
  var txt = document.getElementById('newMessageText').value, sched = document.getElementById('newMessageSchedule').value, dur = document.getElementById('newMessageDuration').value;
  var availChoice = document.getElementById('newMessageAvail').value;
  if (!txt || !txt.trim()) { await skNotify('Please enter a message', { variant: 'info', title: 'Broadcast' }); return; }
  try {
    var res = await apiRequest(API_BASE_URL + '/api/broadcast/messages/', { method: 'POST', body: JSON.stringify({ message: txt.trim(), active: !sched, scheduled_for: toApiDateTime(sched), duration_minutes: dur ? parseInt(dur) : null }) });
    if (res.ok) {
      // Also set availability if chosen
      if (availChoice) await setAvailability(availChoice === 'true');
      document.getElementById('newMessageText').value = ''; document.getElementById('newMessageSchedule').value = ''; document.getElementById('newMessageDuration').value = ''; document.getElementById('newMessageAvail').value = '';
      closeModal('addMessageModal'); await skNotify(sched ? 'Status scheduled!' : 'Status is now live!', { variant: 'success', title: 'Broadcast' }); loadMessages();
    }
    else { var d = await res.json(); await skNotify(Object.values(d).flat().join(', ') || 'Failed', { variant: 'error', title: 'Broadcast' }); }
  } catch (e) { await skNotify('Failed to add status', { variant: 'error', title: 'Broadcast' }); }
}

function openEditModal(id, message, scheduledFor, durationMinutes) {
  document.getElementById('editMessageId').value = id;
  document.getElementById('editMessageTextarea').value = message;
  document.getElementById('editMessageSchedule').value = toLocalDateTimeInput(scheduledFor);
  document.getElementById('editMessageDuration').value = durationMinutes || '';
  openModal('editMessageModal');
}

async function submitEditMessage() {
  var id = document.getElementById('editMessageId').value, txt = document.getElementById('editMessageTextarea').value;
  var sched = document.getElementById('editMessageSchedule').value, dur = document.getElementById('editMessageDuration').value;
  if (!txt || !txt.trim()) { await skNotify('Please enter a message', { variant: 'info', title: 'Broadcast' }); return; }
  try {
    var res = await apiRequest(API_BASE_URL + '/api/broadcast/messages/' + id + '/', { method: 'PATCH', body: JSON.stringify({ message: txt.trim(), active: !sched, scheduled_for: toApiDateTime(sched), duration_minutes: dur ? parseInt(dur) : null }) });
    if (res.ok) { closeModal('editMessageModal'); await skNotify('Status updated!', { variant: 'success', title: 'Broadcast' }); loadMessages(); }
    else { var d = await res.json(); await skNotify(Object.values(d).flat().join(', ') || 'Failed', { variant: 'error', title: 'Broadcast' }); }
  } catch (e) { await skNotify('Failed to update', { variant: 'error', title: 'Broadcast' }); }
}

async function toggleMsg(id) {
  try {
    var res = await apiRequest(API_BASE_URL + '/api/broadcast/messages/' + id + '/set_active/', { method: 'POST' });
    var d = await res.json();
    if (res.ok) { await skNotify(d.message || 'Updated!', { variant: 'success', title: 'Broadcast' }); loadMessages(); }
    else await skNotify(d.message || 'Failed', { variant: 'error', title: 'Broadcast' });
  } catch (e) { await skNotify('Failed', { variant: 'error', title: 'Broadcast' }); }
}

function confirmDeleteMsg(id) {
  skConfirm('Delete this broadcast status?', { title: 'Delete', confirmText: 'Delete', danger: true }).then(function (ok) { if (ok) deleteMsg(id); });
}
async function deleteMsg(id) {
  try {
    var res = await apiRequest(API_BASE_URL + '/api/broadcast/messages/' + id + '/', { method: 'DELETE' });
    if (res.ok) { await skNotify('Deleted!', { variant: 'success', title: 'Broadcast' }); loadMessages(); }
  } catch (e) { await skNotify('Failed to delete', { variant: 'error', title: 'Broadcast' }); }
}

// Footer contributors
async function loadFooterContributors() {
  try {
    var res = await fetch(window.sirKothayContributorsApiUrl()); var data = await res.json();
    var el = document.getElementById('contributorAvatars');
    if (el) el.innerHTML = data.slice(0, 6).map(function (c) { return '<a href="' + c.html_url + '" target="_blank"><img src="' + c.avatar_url + '" class="h-8 w-8 rounded-full" alt="' + c.login + '"></a>'; }).join('');
  } catch (e) {}
}
loadFooterContributors();
loadDashboard();
