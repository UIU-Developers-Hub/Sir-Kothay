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

function updateFacultyShellActive(tab) {
  var map = {
    messages: { page: 'broadcast', title: 'Broadcast' },
    broadcast: { page: 'broadcast', title: 'Broadcast' },
    templates: { page: 'templates', title: 'Quick Status' },
    schedules: { page: 'calendar', title: 'Calendar' },
    calendar: { page: 'calendar', title: 'Calendar' },
    inbox: { page: 'inbox', title: 'Messages' },
    'fc-settings': { page: 'settings', title: 'Settings' }
  };
  var meta = map[tab] || { page: 'dashboard', title: 'Dashboard' };
  document.querySelectorAll('.sk-sidebar-link.active, .sk-bottom-nav-item.active').forEach(function (el) {
    el.classList.remove('active');
  });
  document.querySelectorAll('[data-page="' + meta.page + '"]').forEach(function (el) {
    el.classList.add('active');
  });
  var title = document.querySelector('.sk-topbar-title');
  if (title) title.textContent = meta.title;
}

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
      updateFacultyShellActive(tab);
      // Update URL to reflect active tab
      var url = new URL(window.location);
      url.searchParams.set('tab', tab);
      history.replaceState(null, '', url);
      if (tab === 'templates') loadTemplates();
      else if (tab === 'calendar') {
        loadCalendarEvents();
        loadSchedules();
      }
      else if (tab === 'inbox') loadUnifiedInbox();
      else if (tab === 'fc-settings') loadFacultySettings();
    });
  });

  // Handle URL params (e.g. ?tab=chats&thread=5)
  var params = new URLSearchParams(window.location.search);
  var tabParam = params.get('tab');
  var threadParam = params.get('thread');
  if (tabParam) {
    // Use a microtask to ensure all scripts have initialized
    setTimeout(function () {
      // Map old URL params to the internal section ids.
      var mappedTab = tabParam === 'chats' ? 'inbox' :
        (tabParam === 'broadcast' ? 'messages' :
          (tabParam === 'schedules' ? 'calendar' :
            (tabParam === 'analytics' ? 'messages' : tabParam)));
      var tabBtn = document.querySelector('[data-tab="' + mappedTab + '"]');
      if (tabBtn) tabBtn.click();
      if (threadParam && (tabParam === 'chats' || tabParam === 'inbox')) {
        setTimeout(function () { openConversation('thread', parseInt(threadParam)); }, 200);
      }
    }, 0);
  } else {
    updateFacultyShellActive('messages');
  }
});

// --- Profile & Dashboard Load ---
var userSlug = null;

async function loadDashboard() {
  if (!checkAuth()) return;
  try {
    // Role Check
    var meRes = await fetch(API_BASE_URL + '/api/auth/users/me/', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') } });
    if (meRes.ok) {
      var meData = await meRes.json();
      if (meData.role === 'STUDENT') { window.location.href = 'student.html'; return; }
      if (!meData.role && meData.is_staff) { window.location.href = 'admin.html'; return; }
      // If user is admin (is_staff), inject Admin Panel link into navbar
      if (meData.is_staff) {
        var desktopNav = document.getElementById('desktopNavLinks');
        if (desktopNav) {
          var adminLink = document.createElement('a');
          adminLink.href = 'admin.html';
          adminLink.className = 'text-purple-600 font-semibold';
          adminLink.style.cssText = 'transition: color 0.2s;';
          adminLink.innerHTML = '<i class="bi bi-shield-lock mr-1"></i>Admin';
          desktopNav.insertBefore(adminLink, desktopNav.firstChild);
        }
        var mobileNav = document.getElementById('mobileNavLinks');
        if (mobileNav) {
          var mAdminLink = document.createElement('a');
          mAdminLink.href = 'admin.html';
          mAdminLink.className = 'flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-purple-600 hover:bg-purple-50 transition';
          mAdminLink.innerHTML = '<i class="bi bi-shield-lock-fill text-2xl"></i><span class="text-xs font-medium">Admin</span>';
          mobileNav.insertBefore(mAdminLink, mobileNav.firstChild);
        }
      }
    }

    var res = await apiRequest(API_ENDPOINTS.USER_DETAILS);
    var data = await res.json();
    if (res.ok) {
      document.getElementById('userName').textContent = data.user_username || 'User';
      document.getElementById('userEmail').textContent = data.user_email || '';
      document.getElementById('userPhone').textContent = data.phone_number || '';
      document.getElementById('userOrg').textContent = data.organization || 'N/A';
      document.getElementById('userImage').src = resolveProfileImage(data.profile_image_url || data.profile_image);
      var statusEl = document.getElementById('defaultStatusInput');
      if (statusEl && data.default_status !== undefined) statusEl.value = data.default_status;
      var availEl = document.getElementById('defaultAvailInput');
      if (availEl && data.default_availability !== undefined && data.default_availability !== null) availEl.value = data.default_availability.toString();
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

async function saveDefaultSettings() {
  var statusEl = document.getElementById('defaultStatusInput');
  var availEl = document.getElementById('defaultAvailInput');
  var statusVal = statusEl ? statusEl.value.trim() : '';
  var availVal = availEl ? (availEl.value === 'true') : false;
  try {
    var res = await apiRequest(API_ENDPOINTS.UPDATE_USER_DETAILS, {
      method: 'PATCH', body: JSON.stringify({ default_status: statusVal, default_availability: availVal })
    });
    if (res.ok) await skNotify('Fallback settings saved! These take effect when a timed status expires.', { variant: 'success', title: 'Settings' });
    else await skNotify('Failed to save settings', { variant: 'error', title: 'Settings' });
  } catch (e) { await skNotify('Error saving settings', { variant: 'error', title: 'Settings' }); }
}

// --- Availability Toggle ---
var _isAvailable = false;
function updateAvailabilityUI(available) {
  _isAvailable = !!available;
  var btn = document.getElementById('availabilityToggle');
  var dot = document.getElementById('availDot');
  var label = document.getElementById('availLabel');
  if (!btn || !dot || !label) return;
  if (_isAvailable) {
    btn.className = 'sk-btn sk-btn-sm sk-availability-btn available';
    dot.className = 'sk-availability-dot sk-pulse-dot';
    label.textContent = 'Available';
  } else {
    btn.className = 'sk-btn sk-btn-sm sk-availability-btn unavailable';
    dot.className = 'sk-availability-dot';
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
    if (el) el.innerHTML = '<p class="sk-inline-note">No quick templates yet. <a onclick="document.querySelector(\'[data-tab=templates]\').click()">Create one</a></p>';
    return;
  }
  el.innerHTML = '<div class="sk-template-picks"><p class="sk-template-picks-title">Quick-fill from a template:</p><div class="sk-template-pick-list">' +
    window._quickTemplates.map(function (t) {
      return '<button onclick="fillFromTemplate(\'' + escapeHtml(t.message).replace(/'/g, "\\'") + '\')" ' +
        'class="sk-btn sk-btn-secondary sk-btn-sm">' +
        '<i class="bi ' + escapeHtml(t.icon || 'bi-lightning-fill') + '"></i>' + escapeHtml(t.label) + '</button>';
    }).join('') + '</div></div>';
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
      var sheetEl = document.getElementById('qrCodeSheet');
      if (sheetEl) sheetEl.src = qrCodeUrl;
      document.getElementById('qrActionBtn').innerHTML = '<i class="bi bi-download"></i> Download';
      document.getElementById('qrActionBtn').onclick = function () { openModal('downloadModal'); };
      var regenBtn = document.getElementById('qrRegenerateBtn');
      if (regenBtn) {
        regenBtn.classList.remove('hidden');
        regenBtn.style.display = '';
      }
    }
  } catch (e) { console.log('No QR code found'); }
}
async function handleQRAction() {
  if (qrCodeUrl) openModal('downloadModal');
  else await generateQRCode();
}
async function confirmRegenerateQR() {
  var ok = await skConfirm('Are you sure you want to regenerate your QR code? Any old QR codes you printed or shared will stop working immediately.', { title: 'Regenerate QR Code', confirmText: 'Regenerate', danger: true });
  if (ok) await generateQRCode();
}
async function generateQRCode() {
  var btn = document.getElementById('qrActionBtn');
  btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generating...';
  try {
    var res = await apiRequest(API_BASE_URL + '/api/qrcode/qrcodes/generate/', { method: 'POST' });
    if (res.ok) {
      btn.disabled = false;
      await loadQRCode();
      await skNotify('QR Code generated!', { variant: 'success', title: 'QR code' });
    }
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
    return '<span class="sk-status-badge live"><span class="sk-availability-dot sk-pulse-dot"></span>Live' + untilText + '</span>';
  }
  if (msg.scheduled_for) {
    return '<span class="sk-status-badge scheduled"><i class="bi bi-clock"></i>Scheduled · ' + new Date(msg.scheduled_for).toLocaleString() + '</span>';
  }
  return '<span class="sk-status-badge inactive">Inactive</span>';
}

async function loadMessages() {
  try {
    var res = await apiRequest(API_ENDPOINTS.MESSAGES); var data = await res.json();
    var el = document.getElementById('messagesList');
    if (data && data.length > 0) {
      el.innerHTML = '<div class="sk-broadcast-list">' + data.map(function (msg) {
        var durLabel = msg.duration_seconds ? (msg.duration_seconds < 60 ? msg.duration_seconds + ' s' : (msg.duration_seconds < 3600 ? (msg.duration_seconds / 60) + ' min' : (msg.duration_seconds / 3600) + ' h')) : '∞';
        return '<div class="sk-broadcast-item">' +
          '<div class="sk-broadcast-main"><p class="sk-broadcast-message">' + escapeHtml(msg.message) + '</p>' +
          '<div class="sk-broadcast-meta">' + renderStatusBadge(msg) +
          '<span class="sk-inline-note"><i class="bi bi-hourglass-split"></i> ' + durLabel + '</span></div></div>' +
          '<div class="sk-broadcast-actions">' +
          '<button onclick="toggleMsg(' + msg.id + ',' + msg.active + ')" class="sk-btn ' + (msg.active ? 'sk-btn-danger' : 'sk-btn-success') + ' sk-btn-sm">' + (msg.active ? '<i class="bi bi-pause-fill"></i> Stop' : '<i class="bi bi-play-fill"></i> Go Live') + '</button>' +
          '<button onclick="openEditModal(' + msg.id + ',\'' + escapeHtml(msg.message).replace(/'/g, "\\'") + '\',' + (msg.scheduled_for ? "'" + msg.scheduled_for + "'" : 'null') + ',' + (msg.duration_seconds || 'null') + ',\'' + (msg.set_availability || '') + '\')" class="sk-btn sk-btn-ghost sk-btn-icon" aria-label="Edit status"><i class="bi bi-pencil"></i></button>' +
          '<button onclick="confirmDeleteMsg(' + msg.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" aria-label="Delete status"><i class="bi bi-trash"></i></button>' +
          '</div></div>';
      }).join('') + '</div>';
    } else {
      el.innerHTML = (window.SKComponents ? SKComponents.emptyState('broadcast', 'No broadcast status yet', 'Create your first status to let people know where you are.', '<button onclick="openNewMessageModal()" class="sk-btn sk-btn-primary">Create Your First Status</button>') :
        '<div class="sk-empty-state compact"><div class="sk-empty-icon"><i class="bi bi-broadcast"></i></div><div class="sk-empty-title">No broadcast status yet</div><div class="sk-empty-subtitle">Create your first status to let people know where you are.</div><button onclick="openNewMessageModal()" class="sk-btn sk-btn-primary">Create Your First Status</button></div>');
    }
  } catch (e) {
    document.getElementById('messagesList').innerHTML = '<div class="sk-empty-state compact"><div class="sk-empty-icon"><i class="bi bi-exclamation-triangle"></i></div><div class="sk-empty-title">Failed to load messages</div><div class="sk-empty-subtitle">Please refresh or try again in a moment.</div></div>';
  }
}

function openNewMessageModal() {
  document.getElementById('messageModalTitle').textContent = 'Set Broadcast Status';
  document.getElementById('messageId').value = '';
  document.getElementById('newMessageText').value = '';
  document.getElementById('newMessageSchedule').value = '';
  document.getElementById('newMessageDuration').value = '';
  document.getElementById('newMessageDurationUnit').value = '60';
  document.getElementById('newMessageAvail').value = '';
  openModal('messageModal');
}

function openEditModal(id, message, scheduledFor, durationSeconds, setAvailability) {
  document.getElementById('messageModalTitle').textContent = 'Edit Broadcast Status';
  document.getElementById('messageId').value = id;
  document.getElementById('newMessageText').value = message;
  document.getElementById('newMessageSchedule').value = toLocalDateTimeInput(scheduledFor);
  if (durationSeconds) {
    if (durationSeconds % 86400 === 0) {
      document.getElementById('newMessageDuration').value = durationSeconds / 86400;
      document.getElementById('newMessageDurationUnit').value = '86400';
    } else if (durationSeconds % 3600 === 0) {
      document.getElementById('newMessageDuration').value = durationSeconds / 3600;
      document.getElementById('newMessageDurationUnit').value = '3600';
    } else if (durationSeconds % 60 === 0) {
      document.getElementById('newMessageDuration').value = durationSeconds / 60;
      document.getElementById('newMessageDurationUnit').value = '60';
    } else {
      document.getElementById('newMessageDuration').value = durationSeconds;
      document.getElementById('newMessageDurationUnit').value = '1';
    }
  } else {
    document.getElementById('newMessageDuration').value = '';
    document.getElementById('newMessageDurationUnit').value = '60';
  }
  document.getElementById('newMessageAvail').value = setAvailability || '';
  openModal('messageModal');
}

async function submitMessage(forceGoLive) {
  var id = document.getElementById('messageId').value;
  var txt = document.getElementById('newMessageText').value, sched = document.getElementById('newMessageSchedule').value, dur = document.getElementById('newMessageDuration').value;
  var availChoice = document.getElementById('newMessageAvail').value;
  if (!txt || !txt.trim()) { await skNotify('Please enter a message', { variant: 'info', title: 'Broadcast' }); return; }
  
  try {
    var payload = { 
      message: txt.trim(), 
      active: forceGoLive, 
      scheduled_for: toApiDateTime(sched), 
      duration_seconds: dur ? parseInt(dur) * parseInt(document.getElementById('newMessageDurationUnit').value) : null,
      set_availability: availChoice 
    };
    var url = API_BASE_URL + '/api/broadcast/messages/';
    var method = 'POST';
    
    if (id) {
      url += id + '/';
      method = 'PATCH';
    }
    
    var res = await apiRequest(url, { method: method, body: JSON.stringify(payload) });
    if (res.ok) {
      // Note: Backend now automatically updates availability when the message goes live!
      closeModal('messageModal'); 
      await skNotify(id ? 'Status saved!' : (sched ? 'Status scheduled!' : 'Status is now live!'), { variant: 'success', title: 'Broadcast' }); 
      loadMessages();
      if (forceGoLive) loadDashboard(); // Refresh the availability toggle button in sidebar just in case it activated immediately
    }
    else { var d = await res.json(); await skNotify(Object.values(d).flat().join(', ') || 'Failed', { variant: 'error', title: 'Broadcast' }); }
  } catch (e) { await skNotify('Failed to save status', { variant: 'error', title: 'Broadcast' }); }
}

async function toggleMsg(id, isCurrentlyActive) {
  try {
    var res;
    if (isCurrentlyActive) {
      // Deactivate: PATCH active=false
      res = await apiRequest(API_BASE_URL + '/api/broadcast/messages/' + id + '/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false })
      });
    } else {
      // Activate: POST set_active (also deactivates other messages)
      res = await apiRequest(API_BASE_URL + '/api/broadcast/messages/' + id + '/set_active/', { method: 'POST' });
    }
    var d = await res.json();
    if (res.ok) {
      var msg = isCurrentlyActive ? 'Broadcast stopped' : 'Broadcast is now live!';
      await skNotify(msg, { variant: 'success', title: 'Broadcast' });
      loadMessages();
    } else {
      await skNotify(d.message || 'Failed', { variant: 'error', title: 'Broadcast' });
    }
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

// --- Faculty Notification Settings ---
async function loadFacultySettings() {
  try {
    var res = await apiRequest(API_ENDPOINTS.USER_DETAILS);
    if (!res.ok) return;
    var data = await res.json();
    var el1 = document.getElementById('fcSettingNotifyNew');
    var el2 = document.getElementById('fcSettingNotifyReplies');
    var el3 = document.getElementById('fcSettingNotifyClosed');
    var el4 = document.getElementById('fcSettingAutoClose');
    if (el1) el1.checked = !!data.notify_new_chats;
    if (el2) el2.checked = !!data.notify_chat_replies;
    if (el3) el3.checked = !!data.notify_chat_closed;
    if (el4) el4.value = data.auto_close_hours != null ? String(data.auto_close_hours) : '';
  } catch (e) { console.error(e); }
}

async function saveFacultySettings() {
  try {
    var autoClose = document.getElementById('fcSettingAutoClose').value;
    var payload = {
      notify_new_chats: document.getElementById('fcSettingNotifyNew').checked,
      notify_chat_replies: document.getElementById('fcSettingNotifyReplies').checked,
      notify_chat_closed: document.getElementById('fcSettingNotifyClosed').checked,
      auto_close_hours: autoClose === '' ? null : parseInt(autoClose),
    };
    var res = await apiRequest(API_ENDPOINTS.UPDATE_USER_DETAILS, {
      method: 'PATCH', body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed');
    await skNotify('Settings saved.', { variant: 'success', title: 'Settings' });
  } catch (e) {
    await skNotify('Failed to save settings.', { variant: 'error', title: 'Settings' });
  }
}

// Footer contributors
async function loadFooterContributors() {
  try {
    var el = document.getElementById('contributorAvatars');
    if (!el) return;
    var res = await fetch(window.sirKothayContributorsApiUrl()); var data = await res.json();
    if (el) el.innerHTML = data.slice(0, 6).map(function (c) { return '<a href="' + c.html_url + '" target="_blank"><img src="' + c.avatar_url + '" class="h-8 w-8 rounded-full" alt="' + c.login + '"></a>'; }).join('');
  } catch (e) {}
}
document.addEventListener('DOMContentLoaded', function () {
  loadFooterContributors();
  loadDashboard();
});
