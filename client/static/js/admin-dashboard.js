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

function _esc(value) {
  var d = document.createElement('div');
  d.textContent = value == null ? '' : String(value);
  return d.innerHTML;
}

function _initial(name) {
  return _esc((name || 'U').charAt(0).toUpperCase());
}

function _roleBadge(role) {
  if (!role) return '<span class="sk-admin-badge role-none">None</span>';
  var cls = role === 'FACULTY' ? 'role-faculty' : (role === 'STUDENT' ? 'role-student' : 'role-none');
  return '<span class="sk-admin-badge ' + cls + '">' + _esc(role) + '</span>';
}

function _statusBadge(u) {
  if (u.is_banned) return '<span class="sk-admin-badge status-banned"><i class="bi bi-slash-circle-fill"></i>Banned</span>';
  if (!u.is_active) return '<span class="sk-admin-badge status-deactivated"><i class="bi bi-pause-circle-fill"></i>Deactivated</span>';
  return '<span class="sk-admin-badge status-active"><i class="bi bi-check-circle-fill"></i>Active</span>';
}

function _adminBadge(u) {
  if (u.is_staff) return ' <span class="sk-admin-badge role-admin">ADMIN</span>';
  return '';
}

function _headers() {
  return { 'Authorization': 'Bearer ' + localStorage.getItem('access_token'), 'Content-Type': 'application/json' };
}

function _setStudentIdGroupVisible(visible) {
  var group = document.getElementById('crStudentIdGroup');
  if (!group) return;
  group.classList.toggle('hidden', !visible);
  group.style.display = visible ? 'block' : 'none';
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

    actions += '<button onclick="event.stopPropagation(); showUserDetail(' + u.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon" title="View details" aria-label="View details"><i class="bi bi-eye"></i></button>';

    if (u.is_banned) {
      actions += '<button onclick="event.stopPropagation(); unbanUser(' + u.id + ')" class="sk-btn sk-btn-success sk-btn-sm" title="Unban"><i class="bi bi-unlock"></i>Unban</button>';
    } else if (!u.is_active) {
      actions += '<button onclick="event.stopPropagation(); toggleUserActive(' + u.id + ')" class="sk-btn sk-btn-success sk-btn-sm" title="Activate"><i class="bi bi-check-circle"></i>Activate</button>';
      actions += '<button onclick="event.stopPropagation(); banUser(' + u.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Ban" aria-label="Ban"><i class="bi bi-slash-circle"></i></button>';
    } else {
      actions += '<button onclick="event.stopPropagation(); toggleUserActive(' + u.id + ')" class="sk-btn sk-btn-secondary sk-btn-sm" title="Deactivate"><i class="bi bi-pause-circle"></i>Deactivate</button>';
      actions += '<button onclick="event.stopPropagation(); banUser(' + u.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Ban" aria-label="Ban"><i class="bi bi-slash-circle"></i></button>';
    }

    actions += '<button onclick="event.stopPropagation(); deleteUser(' + u.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>';

    return '<tr ondblclick="showUserDetail(' + u.id + ')">' +
      '<td>' + u.id + '</td>' +
      '<td><div class="sk-admin-user-cell">' +
        '<div class="sk-admin-avatar">' + _initial(u.username) + '</div>' +
        '<div><div class="sk-admin-name">' + _esc(u.username) +
        (isSelf ? ' <span class="sk-admin-self">(You)</span>' : '') +
        _adminBadge(u) +
        '</div>' +
        (u.student_id ? '<div class="sk-admin-sub">ID: ' + _esc(u.student_id) + '</div>' : '') +
        '</div></div></td>' +
      '<td><span class="sk-admin-sub">' + _esc(u.email) + '</span></td>' +
      '<td>' + _roleBadge(u.role) + '</td>' +
      '<td>' + _statusBadge(u) + '</td>' +
      '<td><span class="sk-admin-sub" title="' + new Date(u.date_joined).toLocaleString() + '">' + _relativeTime(u.date_joined) + '</span></td>' +
      '<td><div class="sk-admin-actions">' + actions + '</div></td>' +
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
  var confirmed = await _confirm('Permanently delete "' + user.username + '" (' + user.email + ')?\n\nThis cannot be undone.');
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

async function resetUserPassword(userId) {
  var user = adminUsers.find(function(u) { return u.id === userId; });
  if (!user) return;
  var confirmed = await _confirm('Generate a new random password for "' + user.username + '" and email it to them?');
  if (!confirmed) return;
  try {
    var res = await fetch(API_BASE_URL + '/api/dashboard/admin-users/' + userId + '/reset_password/', {
      method: 'POST', headers: _headers()
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    _notify(data.message || 'Password reset successfully.', 'success');
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
  _setStudentIdGroupVisible(false);

  // Build radio options (exclude current role)
  var allRoles = [
    { value: 'FACULTY', label: 'Faculty', icon: 'bi-mortarboard', desc: 'Can broadcast availability, manage schedule' },
    { value: 'STUDENT', label: 'Student', icon: 'bi-person-badge', desc: 'Can subscribe, message faculty' },
    { value: '', label: 'None (Admin only)', icon: 'bi-shield-lock', desc: 'No dashboard role — admin panel access only' }
  ];
  var options = allRoles.filter(function(r) { return r.value !== user.role; });

  var html = '';
  options.forEach(function(opt, i) {
    html += '<label class="sk-role-option">' +
      '<input type="radio" name="crRole" value="' + opt.value + '"' + (i === 0 ? ' checked' : '') +
      ' onchange="_setStudentIdGroupVisible(this.value === \'STUDENT\')">' +
      '<i class="bi ' + opt.icon + '"></i>' +
      '<div><span class="sk-role-option-title">' + opt.label + '</span>' +
      '<p class="sk-role-option-desc">' + opt.desc + '</p></div>' +
      '</label>';
  });
  document.getElementById('crRoleOptions').innerHTML = html;

  // Show student ID input if first option is STUDENT
  _setStudentIdGroupVisible(!!(options[0] && options[0].value === 'STUDENT'));

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
    '<div class="sk-admin-detail-head">' +
      '<div class="sk-admin-avatar lg">' + _initial(user.username) + '</div>' +
      '<h3 class="sk-admin-detail-name">' + _esc(user.username) +
        (isSelf ? ' <span class="sk-admin-self">(You)</span>' : '') +
      '</h3>' +
      '<p class="sk-admin-detail-email">' + _esc(user.email) + '</p>' +
      _adminBadge(user) +
    '</div>' +
    '<div class="sk-admin-detail-list">';

  var rows = [
    ['User ID', '#' + user.id],
    ['Role', _roleBadge(user.role)],
    ['Status', _statusBadge(user)],
    ['Admin', user.is_staff ? '<span class="sk-admin-badge role-admin">Yes</span>' : '<span class="sk-admin-badge role-none">No</span>'],
  ];
  if (user.student_id) rows.push(['Student ID', '<strong>' + _esc(user.student_id) + '</strong>']);
  if (user.first_name || user.last_name) rows.push(['Full Name', _esc(((user.first_name || '') + ' ' + (user.last_name || '')).trim())]);
  rows.push(['Joined', _esc(new Date(user.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))]);

  rows.forEach(function(r) {
    html += '<div class="sk-admin-detail-row">' +
      '<span class="sk-admin-detail-label">' + _esc(r[0]) + '</span>' +
      '<span class="sk-admin-detail-value">' + r[1] + '</span>' +
    '</div>';
  });
  html += '</div>';

  html += '<div class="sk-admin-detail-actions">' +
    '<h4 class="sk-admin-action-title">Actions</h4>';

  html += '<button onclick="changeRole(' + user.id + ')" class="sk-btn sk-btn-secondary"><i class="bi bi-arrow-left-right"></i>Change Role</button>';

  html += '<button onclick="toggleAdmin(' + user.id + ')" class="sk-btn sk-btn-secondary"><i class="bi bi-shield-lock"></i>' + (user.is_staff ? 'Remove Admin Privilege' : 'Grant Admin Privilege') + '</button>';

  if (user.is_banned) {
    html += '<button onclick="unbanUser(' + user.id + ')" class="sk-btn sk-btn-success"><i class="bi bi-unlock"></i>Unban User</button>';
  } else {
    if (user.is_active) {
      html += '<button onclick="toggleUserActive(' + user.id + ')" class="sk-btn sk-btn-secondary"><i class="bi bi-pause-circle"></i>Deactivate User</button>';
    } else {
      html += '<button onclick="toggleUserActive(' + user.id + ')" class="sk-btn sk-btn-success"><i class="bi bi-check-circle"></i>Activate User</button>';
    }
    html += '<button onclick="banUser(' + user.id + ')" class="sk-btn sk-btn-danger"><i class="bi bi-slash-circle"></i>Ban User</button>';
  }

  html += '<button onclick="resetUserPassword(' + user.id + ')" class="sk-btn sk-btn-warning"><i class="bi bi-key"></i>Reset Password</button>';
  html += '<button onclick="deleteUser(' + user.id + ')" class="sk-btn sk-btn-ghost danger"><i class="bi bi-trash"></i>Delete User Permanently</button>';

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
