/* ── Admin Dashboard JS (v3) ── */
let adminUsers = [];
let currentSort = { key: 'id', dir: 'asc' };
let currentAdminUser = null;

/* ── Helpers ── */
function _notify(msg, variant) {
  if (typeof skNotify !== 'undefined') skNotify(msg, { variant: variant || 'info' });
  else alert(msg);
}

function _confirm(msg) {
  if (typeof skConfirm !== 'undefined') return skConfirm(msg, { danger: true });
  return Promise.resolve(window.confirm(msg));
}

function _relativeTime(dateStr) {
  if (!dateStr) return '—';
  var d = new Date(dateStr), now = new Date(), diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString();
}

function _roleBadge(role) {
  if (!role) return '<span class="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs font-semibold italic">— None —</span>';
  var map = { 'FACULTY': 'bg-blue-100 text-blue-800', 'STUDENT': 'bg-green-100 text-green-800' };
  return '<span class="' + (map[role] || 'bg-gray-200 text-gray-700') + ' px-2 py-1 rounded text-xs font-semibold">' + role + '</span>';
}

function _statusBadge(u) {
  if (u.is_banned) return '<span class="bg-red-200 text-red-900 px-2 py-1 rounded text-xs font-semibold"><i class="bi bi-slash-circle-fill mr-1"></i>Banned</span>';
  if (!u.is_active) return '<span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold"><i class="bi bi-pause-circle-fill mr-1"></i>Deactivated</span>';
  return '<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold"><i class="bi bi-check-circle-fill mr-1"></i>Active</span>';
}

function _adminBadge(u) {
  if (u.is_staff) return ' <span class="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px] font-bold ml-1">ADMIN</span>';
  return '';
}

function _headers() {
  return { 'Authorization': 'Bearer ' + localStorage.getItem('access_token'), 'Content-Type': 'application/json' };
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async function() {
  var token = localStorage.getItem('access_token');
  if (!token) { window.location.href = '../auth/login.html'; return; }
  await loadAdminPanel();
});

async function loadAdminPanel() {
  try {
    var headers = _headers();
    var meRes = await fetch(API_BASE_URL + '/api/auth/users/me/', { headers: headers });
    if (!meRes.ok) throw new Error('Auth failed');
    currentAdminUser = await meRes.json();

    if (!currentAdminUser.is_staff) {
      window.location.href = currentAdminUser.role === 'STUDENT' ? 'student.html' : 'home.html';
      return;
    }

    document.getElementById('adminGreeting').textContent = 'Welcome, ' + currentAdminUser.username + '. Manage system users, roles, and status.';

    // Show Dashboard link if user has a role (not admin-only)
    if (currentAdminUser.role) {
      var dashUrl = currentAdminUser.role === 'STUDENT' ? 'student.html' : 'home.html';
      var dLink = document.getElementById('dashboardLink');
      if (dLink) { dLink.href = dashUrl; dLink.classList.remove('hidden'); }
      var dLinkM = document.getElementById('dashboardLinkMobile');
      if (dLinkM) { dLinkM.href = dashUrl; dLinkM.classList.remove('hidden'); }
    }

    var usersRes = await fetch(API_BASE_URL + '/api/dashboard/admin-users/', { headers: headers });
    if (!usersRes.ok) throw new Error('Failed to load users');
    adminUsers = await usersRes.json();

    updateCounts();
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    renderAdminUsers();
  } catch (error) {
    console.error(error);
    _notify('Error loading admin panel: ' + error.message, 'error');
    localStorage.removeItem('access_token');
    setTimeout(function() { window.location.href = '../auth/login.html'; }, 2000);
  }
}

function updateCounts() {
  document.getElementById('totalUsersCount').textContent = adminUsers.length;
  document.getElementById('facultyCount').textContent = adminUsers.filter(function(u) { return u.role === 'FACULTY'; }).length;
  document.getElementById('studentCount').textContent = adminUsers.filter(function(u) { return u.role === 'STUDENT'; }).length;
  document.getElementById('adminCount').textContent = adminUsers.filter(function(u) { return u.is_staff; }).length;
}

/* ── Sorting ── */
function setSort(key) {
  if (currentSort.key === key) currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
  else { currentSort.key = key; currentSort.dir = 'asc'; }
  renderAdminUsers();
}

function updateSortIcons() {
  ['id', 'username', 'email', 'role', 'status', 'date_joined'].forEach(function(k) {
    var el = document.getElementById('sortIcon_' + k);
    if (!el) return;
    var th = el.parentElement;
    if (k === currentSort.key || (k === 'status' && currentSort.key === 'is_active')) {
      el.className = 'bi ' + (currentSort.dir === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill');
      if (th) th.classList.add('active');
    } else {
      el.className = 'bi bi-caret-up-fill';
      if (th) th.classList.remove('active');
    }
  });
}

function sortUsers(list) {
  var key = currentSort.key, dir = currentSort.dir === 'asc' ? 1 : -1;
  return list.slice().sort(function(a, b) {
    var va = a[key], vb = b[key];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (typeof va === 'boolean') { va = va ? 1 : 0; vb = vb ? 1 : 0; }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

/* ── Filters ── */
function resetFilters() {
  document.getElementById('adminSearch').value = '';
  document.getElementById('filterRole').value = '';
  document.getElementById('filterStatus').value = '';
  currentSort = { key: 'id', dir: 'asc' };
  renderAdminUsers();
}

/* ── Render Table ── */
function renderAdminUsers() {
  var query = document.getElementById('adminSearch').value.toLowerCase();
  var roleFilter = document.getElementById('filterRole').value;
  var statusFilter = document.getElementById('filterStatus').value;
  var tbody = document.getElementById('adminUsersTable');
  var emptyMsg = document.getElementById('emptyTableMessage');

  var filtered = adminUsers.filter(function(u) {
    var matchesQuery = !query || u.username.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.student_id && u.student_id.toLowerCase().includes(query));
    var matchesRole = !roleFilter || (roleFilter === 'NONE' ? !u.role : u.role === roleFilter);
    var matchesStatus = !statusFilter ||
      (statusFilter === 'active' && u.is_active && !u.is_banned) ||
      (statusFilter === 'deactivated' && !u.is_active && !u.is_banned) ||
      (statusFilter === 'banned' && u.is_banned);
    return matchesQuery && matchesRole && matchesStatus;
  });

  filtered = sortUsers(filtered);
  updateSortIcons();
  document.getElementById('filteredCount').textContent =
    filtered.length === adminUsers.length ? '' : 'Showing ' + filtered.length + ' of ' + adminUsers.length;

  if (!filtered.length) { tbody.innerHTML = ''; emptyMsg.classList.remove('hidden'); return; }
  emptyMsg.classList.add('hidden');

  tbody.innerHTML = filtered.map(function(u) {
    var isSelf = currentAdminUser && u.id === currentAdminUser.id;
    var actions = '';

    // View details
    actions += '<button onclick="event.stopPropagation(); showUserDetail(' + u.id + ')" class="text-gray-500 hover:text-orange-600 mr-1 transition" title="View details"><i class="bi bi-eye"></i></button>';

    // Status actions
    if (u.is_banned) {
      actions += '<button onclick="event.stopPropagation(); unbanUser(' + u.id + ')" class="px-2 py-1 rounded text-xs font-medium text-green-600 bg-green-50 hover:bg-green-500 hover:text-white transition" title="Unban"><i class="bi bi-unlock mr-1"></i>Unban</button>';
    } else if (!u.is_active) {
      actions += '<button onclick="event.stopPropagation(); toggleUserActive(' + u.id + ')" class="px-2 py-1 rounded text-xs font-medium text-green-600 bg-green-50 hover:bg-green-500 hover:text-white transition mr-1" title="Activate"><i class="bi bi-check-circle mr-1"></i>Activate</button>';
      actions += '<button onclick="event.stopPropagation(); banUser(' + u.id + ')" class="px-2 py-1 rounded text-xs font-medium text-red-600 bg-red-50 hover:bg-red-500 hover:text-white transition" title="Ban"><i class="bi bi-slash-circle mr-1"></i>Ban</button>';
    } else {
      actions += '<button onclick="event.stopPropagation(); toggleUserActive(' + u.id + ')" class="px-2 py-1 rounded text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-500 hover:text-white transition mr-1" title="Deactivate"><i class="bi bi-pause-circle mr-1"></i>Deact.</button>';
      actions += '<button onclick="event.stopPropagation(); banUser(' + u.id + ')" class="px-2 py-1 rounded text-xs font-medium text-red-600 bg-red-50 hover:bg-red-500 hover:text-white transition" title="Ban"><i class="bi bi-slash-circle mr-1"></i>Ban</button>';
    }

    // Delete
    actions += ' <button onclick="event.stopPropagation(); deleteUser(' + u.id + ')" class="text-gray-400 hover:text-red-600 ml-1 transition" title="Delete"><i class="bi bi-trash"></i></button>';

    return '<tr class="hover:bg-gray-50 transition cursor-pointer" ondblclick="showUserDetail(' + u.id + ')">' +
      '<td class="p-3 text-gray-500">' + u.id + '</td>' +
      '<td class="p-3"><div class="flex items-center gap-2">' +
        '<div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs">' + u.username.charAt(0).toUpperCase() + '</div>' +
        '<div><span class="font-medium text-gray-800">' + u.username + '</span>' +
        (isSelf ? ' <span class="text-xs text-orange-500 font-bold">(You)</span>' : '') +
        _adminBadge(u) +
        (u.student_id ? '<br><span class="text-xs text-gray-400">ID: ' + u.student_id + '</span>' : '') +
        '</div></div></td>' +
      '<td class="p-3 text-gray-600 text-xs">' + u.email + '</td>' +
      '<td class="p-3">' + _roleBadge(u.role) + '</td>' +
      '<td class="p-3">' + _statusBadge(u) + '</td>' +
      '<td class="p-3 text-gray-400 text-xs" title="' + new Date(u.date_joined).toLocaleString() + '">' + _relativeTime(u.date_joined) + '</td>' +
      '<td class="p-3 text-center whitespace-nowrap">' + actions + '</td>' +
      '</tr>';
  }).join('');
}

/* ── Actions ── */
async function toggleUserActive(userId) {
  var user = adminUsers.find(function(u) { return u.id === userId; });
  if (!user) return;
  var action = user.is_active ? 'deactivate' : 'activate';
  var confirmed = await _confirm('Are you sure you want to ' + action + ' "' + user.username + '"?');
  if (!confirmed) return;
  try {
    var res = await fetch(API_BASE_URL + '/api/dashboard/admin-users/' + userId + '/toggle_active/', {
      method: 'POST', headers: _headers()
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    user.is_active = data.is_active;
    user.is_banned = data.is_banned;
    renderAdminUsers();
    _notify('"' + user.username + '" is now ' + (data.is_active ? 'active' : 'deactivated') + '.', 'success');
  } catch (e) { _notify('Error: ' + e.message, 'error'); }
}

async function banUser(userId) {
  var user = adminUsers.find(function(u) { return u.id === userId; });
  if (!user) return;
  var confirmed = await _confirm('Ban "' + user.username + '"? They will NOT be able to log in.');
  if (!confirmed) return;
  try {
    var res = await fetch(API_BASE_URL + '/api/dashboard/admin-users/' + userId + '/ban_user/', {
      method: 'POST', headers: _headers()
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    user.is_active = data.is_active;
    user.is_banned = data.is_banned;
    renderAdminUsers();
    _notify('"' + user.username + '" has been banned.', 'success');
  } catch (e) { _notify('Error: ' + e.message, 'error'); }
}

async function unbanUser(userId) {
  var user = adminUsers.find(function(u) { return u.id === userId; });
  if (!user) return;
  try {
    var res = await fetch(API_BASE_URL + '/api/dashboard/admin-users/' + userId + '/unban_user/', {
      method: 'POST', headers: _headers()
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    user.is_active = data.is_active;
    user.is_banned = data.is_banned;
    renderAdminUsers();
    _notify('"' + user.username + '" has been unbanned.', 'success');
  } catch (e) { _notify('Error: ' + e.message, 'error'); }
}

async function deleteUser(userId) {
  var user = adminUsers.find(function(u) { return u.id === userId; });
  if (!user) return;
  var confirmed = await _confirm('⚠️ Permanently delete "' + user.username + '" (' + user.email + ')?\n\nThis cannot be undone.');
  if (!confirmed) return;
  try {
    var res = await fetch(API_BASE_URL + '/api/dashboard/admin-users/' + userId + '/', {
      method: 'DELETE', headers: _headers()
    });
    if (!res.ok) { var d = await res.json().catch(function(){return{};}); throw new Error(d.error || 'Failed'); }
    adminUsers = adminUsers.filter(function(u) { return u.id !== userId; });
    updateCounts(); renderAdminUsers(); closeUserDetail();
    _notify('"' + user.username + '" deleted.', 'success');
  } catch (e) { _notify('Error: ' + e.message, 'error'); }
}

async function toggleAdmin(userId) {
  var user = adminUsers.find(function(u) { return u.id === userId; });
  if (!user) return;
  var action = user.is_staff ? 'remove admin privileges from' : 'grant admin privileges to';
  var confirmed = await _confirm(action.charAt(0).toUpperCase() + action.slice(1) + ' "' + user.username + '"?');
  if (!confirmed) return;
  try {
    var res = await fetch(API_BASE_URL + '/api/dashboard/admin-users/' + userId + '/toggle_admin/', {
      method: 'POST', headers: _headers()
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    user.is_staff = data.is_staff;
    updateCounts(); renderAdminUsers();
    _notify('"' + user.username + '" is ' + (data.is_staff ? 'now an admin' : 'no longer an admin') + '.', 'success');
    // Re-render detail panel if open
    if (!document.getElementById('userDetailOverlay').classList.contains('hidden')) showUserDetail(userId);
  } catch (e) { _notify('Error: ' + e.message, 'error'); }
}

function changeRole(userId) {
  var user = adminUsers.find(function(u) { return u.id === userId; });
  if (!user) return;

  // Populate the modal
  document.getElementById('crUserId').value = userId;
  document.getElementById('crUserName').textContent = user.username;
  document.getElementById('crStudentId').value = '';
  document.getElementById('crStudentIdGroup').classList.add('hidden');

  // Build radio options (exclude current role)
  var allRoles = [
    { value: 'FACULTY', label: 'Faculty', icon: 'bi-mortarboard', desc: 'Can broadcast availability, manage schedule' },
    { value: 'STUDENT', label: 'Student', icon: 'bi-person-badge', desc: 'Can subscribe, message faculty' },
    { value: '', label: 'None (Admin only)', icon: 'bi-shield-lock', desc: 'No dashboard role — admin panel access only' }
  ];
  var options = allRoles.filter(function(r) { return r.value !== user.role; });

  var html = '';
  options.forEach(function(opt, i) {
    html += '<label class="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition cr-role-label">' +
      '<input type="radio" name="crRole" value="' + opt.value + '" class="accent-blue-600 w-4 h-4"' + (i === 0 ? ' checked' : '') +
      ' onchange="document.getElementById(\'crStudentIdGroup\').classList.toggle(\'hidden\', this.value !== \'STUDENT\')">' +
      '<i class="bi ' + opt.icon + ' text-lg text-gray-600"></i>' +
      '<div><span class="font-medium text-sm text-gray-800">' + opt.label + '</span>' +
      '<p class="text-xs text-gray-400">' + opt.desc + '</p></div>' +
      '</label>';
  });
  document.getElementById('crRoleOptions').innerHTML = html;

  // Show student ID input if first option is STUDENT
  if (options[0] && options[0].value === 'STUDENT') {
    document.getElementById('crStudentIdGroup').classList.remove('hidden');
  }

  document.getElementById('changeRoleModal').classList.remove('hidden');
}

function closeChangeRoleModal() {
  document.getElementById('changeRoleModal').classList.add('hidden');
}

async function confirmChangeRole() {
  var userId = parseInt(document.getElementById('crUserId').value, 10);
  var user = adminUsers.find(function(u) { return u.id === userId; });
  if (!user) return;

  var selectedRadio = document.querySelector('input[name="crRole"]:checked');
  if (!selectedRadio) { _notify('Please select a role.', 'error'); return; }
  var newRole = selectedRadio.value;
  var body = { role: newRole };

  if (newRole === 'STUDENT') {
    var sid = document.getElementById('crStudentId').value.trim();
    if (sid) body.student_id = sid;
  }

  closeChangeRoleModal();

  var fromLabel = user.role || 'None';
  var toLabel = newRole || 'None (Admin only)';
  var warning = '';
  if (user.role === 'STUDENT' && newRole !== 'STUDENT') warning = '\n\nThis will clear their Student ID.';
  var confirmed = await _confirm('Change "' + user.username + '" from ' + fromLabel + ' to ' + toLabel + '?' + warning);
  if (!confirmed) return;

  try {
    var res = await fetch(API_BASE_URL + '/api/dashboard/admin-users/' + userId + '/change_role/', {
      method: 'POST', headers: _headers(), body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    user.role = data.role;
    user.student_id = data.student_id;
    updateCounts(); renderAdminUsers();
    _notify('"' + user.username + '" is now ' + (data.role || 'None (Admin only)') + '.', 'success');
    if (!document.getElementById('userDetailOverlay').classList.contains('hidden')) showUserDetail(userId);
  } catch (e) { _notify('Error: ' + e.message, 'error'); }
}

/* ── User Detail Panel ── */
function showUserDetail(userId) {
  var user = adminUsers.find(function(u) { return u.id === userId; });
  if (!user) return;
  var isSelf = currentAdminUser && user.id === currentAdminUser.id;

  var body = document.getElementById('userDetailBody');
  var html = '' +
    '<div class="text-center mb-6">' +
      '<div class="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3 shadow-lg">' +
        user.username.charAt(0).toUpperCase() +
      '</div>' +
      '<h3 class="text-xl font-bold text-gray-800">' + user.username +
        (isSelf ? ' <span class="text-sm text-orange-500">(You)</span>' : '') +
      '</h3>' +
      '<p class="text-gray-500 text-sm">' + user.email + '</p>' +
      _adminBadge(user) +
    '</div>' +
    '<div class="space-y-3">';

  // Info rows
  var rows = [
    ['User ID', '#' + user.id],
    ['Role', _roleBadge(user.role)],
    ['Status', _statusBadge(user)],
    ['Admin', user.is_staff ? '<span class="text-purple-700 font-bold">Yes</span>' : '<span class="text-gray-400">No</span>'],
  ];
  if (user.student_id) rows.push(['Student ID', '<span class="font-mono font-bold">' + user.student_id + '</span>']);
  if (user.first_name || user.last_name) rows.push(['Full Name', ((user.first_name || '') + ' ' + (user.last_name || '')).trim()]);
  rows.push(['Joined', new Date(user.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })]);

  rows.forEach(function(r) {
    html += '<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">' +
      '<span class="text-sm text-gray-600 font-medium">' + r[0] + '</span>' +
      '<span class="text-sm text-gray-800">' + r[1] + '</span>' +
    '</div>';
  });
  html += '</div>';

  // Actions
  html += '<div class="mt-6 space-y-2">' +
    '<h4 class="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2">Actions</h4>';

  // Role change
  html += '<button onclick="changeRole(' + user.id + ')" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition">' +
    '<i class="bi bi-arrow-left-right mr-2"></i>Change Role</button>';

  // Admin toggle
  html += '<button onclick="toggleAdmin(' + user.id + ')" class="w-full py-2.5 rounded-lg text-sm font-semibold ' +
    (user.is_staff ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200' : 'bg-gray-50 text-gray-700 hover:bg-purple-50 hover:text-purple-700 border border-gray-200') + ' transition">' +
    '<i class="bi bi-shield-lock mr-2"></i>' + (user.is_staff ? 'Remove Admin Privilege' : 'Grant Admin Privilege') + '</button>';

  // Status actions
  if (user.is_banned) {
    html += '<button onclick="unbanUser(' + user.id + ')" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition"><i class="bi bi-unlock mr-2"></i>Unban User</button>';
  } else {
    if (user.is_active) {
      html += '<button onclick="toggleUserActive(' + user.id + ')" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200 transition"><i class="bi bi-pause-circle mr-2"></i>Deactivate User</button>';
    } else {
      html += '<button onclick="toggleUserActive(' + user.id + ')" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition"><i class="bi bi-check-circle mr-2"></i>Activate User</button>';
    }
    html += '<button onclick="banUser(' + user.id + ')" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition"><i class="bi bi-slash-circle mr-2"></i>Ban User</button>';
  }

  // Delete
  html += '<button onclick="deleteUser(' + user.id + ')" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-700 border border-gray-200 hover:border-red-200 transition"><i class="bi bi-trash mr-2"></i>Delete User Permanently</button>';

  html += '</div>';

  body.innerHTML = html;
  document.getElementById('userDetailOverlay').classList.remove('hidden');
}

function closeUserDetail() {
  document.getElementById('userDetailOverlay').classList.add('hidden');
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeUserDetail();
});

/* ── Logout ── */
function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '../auth/login.html';
}
