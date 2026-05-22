/* dashboard-chat.js — Unified Messages panel (threads + DMs) */
var _allConvos = [];
var _chatFilter = 'all';
var _activeConvo = null;

function _convoAvatar(src, name, variant) {
  var initial = (name || '?').charAt(0).toUpperCase();
  var extra = variant === 'visitor' ? ' visitor' : '';
  if (src && src !== '../static/images/image.png') {
    return '<div class="sk-convo-avatar' + extra + '"><img src="' + src + '" alt="' + escapeHtml(name || 'User') + '"></div>';
  }
  return '<div class="sk-convo-avatar' + extra + '">' + initial + '</div>';
}

function _chatHeaderAvatar(src, name, variant) {
  var initial = (name || '?').charAt(0).toUpperCase();
  var extra = variant === 'visitor' ? ' visitor' : '';
  if (src && src !== '../static/images/image.png') {
    return '<div class="sk-chat-header-avatar' + extra + '"><img src="' + src + '" alt="' + escapeHtml(name || 'User') + '"></div>';
  }
  return '<div class="sk-chat-header-avatar' + extra + '">' + initial + '</div>';
}

function _statusDot(status) {
  if (status === 'PENDING') return '<span class="sk-convo-dot pending" title="Awaiting"></span>';
  if (status === 'ACTIVE' || status === 'OPEN') return '<span class="sk-convo-dot active" title="Open"></span>';
  return '<span class="sk-convo-dot" title="Closed"></span>';
}

async function loadUnifiedInbox() {
  var threads = [], dms = [];
  try {
    var [tRes, dRes] = await Promise.all([
      apiRequest(API_BASE_URL + '/api/messaging/chat/threads/'),
      apiRequest(API_BASE_URL + '/api/messaging/inbox/')
    ]);
    if (tRes.ok) threads = await tRes.json();
    if (dRes.ok) dms = await dRes.json();
  } catch (e) { console.error(e); }

  _allConvos = [];
  threads.forEach(function (t) {
    var info = t.student_info || {};
    _allConvos.push({
      type: 'thread', id: t.id, name: info.username || 'Student',
      email: info.email || '', avatar: resolveProfileImage(info.profile_image_url),
      subject: t.subject, status: t.status, studentId: info.student_id || '',
      lastMsg: t.last_message ? t.last_message.body : '',
      lastTime: t.last_activity_at || t.created_at,
      unread: false, raw: t
    });
  });
  dms.forEach(function (d) {
    var replies = _parseReplies(d.reply_body);
    _allConvos.push({
      type: 'dm', id: d.id, name: d.sender_name, email: d.sender_email,
      avatar: '', subject: d.subject || 'Direct Message', status: d.is_closed ? 'CLOSED' : 'OPEN',
      studentId: d.sender_student_id || '', isRegistered: d.sender_is_registered,
      lastMsg: replies.length ? replies[replies.length - 1].body : d.body,
      lastTime: d.replied_at || d.created_at, unread: !d.is_read, raw: d
    });
  });

  _allConvos.sort(function (a, b) { return new Date(b.lastTime) - new Date(a.lastTime); });
  _renderConvoList();
  _initFilterBtns();
  _updateBadge();
}

function _initFilterBtns() {
  document.querySelectorAll('.chat-filter-btn').forEach(function (b) {
    var f = b.dataset.filter;
    b.className = 'chat-filter-btn sk-chat-filter-btn' + (f === _chatFilter ? ' active' : '');
  });
}

function _setChatFilter(f) { _chatFilter = f; _initFilterBtns(); _renderConvoList(); }

function _filterConversations() { _renderConvoList(); }

function _renderConvoList() {
  var el = document.getElementById('conversationList');
  var search = (document.getElementById('chatSearchInput') || {}).value || '';
  search = search.toLowerCase();
  var items = _allConvos.filter(function (c) {
    if (_chatFilter === 'threads' && c.type !== 'thread') return false;
    if (_chatFilter === 'dms' && c.type !== 'dm') return false;
    if (search && c.name.toLowerCase().indexOf(search) === -1 && c.subject.toLowerCase().indexOf(search) === -1 && c.email.toLowerCase().indexOf(search) === -1) return false;
    return true;
  });

  if (!items.length) {
    el.innerHTML = '<div class="sk-convo-empty"><i class="bi bi-chat-square"></i><p>No conversations found</p></div>';
    return;
  }

  el.innerHTML = items.map(function (c) {
    var isActive = _activeConvo && _activeConvo.type === c.type && _activeConvo.id === c.id;
    var badge = '';
    if (c.type === 'thread') {
      badge = _statusDot(c.status);
    }
    var verified = c.studentId ? '<i class="bi bi-patch-check-fill" style="color:var(--sk-primary);font-size:0.625rem"></i>' : '';
    var typeBadge = c.type === 'dm' ? '<span class="sk-convo-type visitor">Visitor</span>' : '';
    var unreadDot = c.unread ? '<span class="sk-convo-dot unread"></span>' : '';
    return '<div class="sk-convo-item ' + (isActive ? 'active' : '') + '" onclick="openConversation(\'' + c.type + '\',' + c.id + ')">' +
      _convoAvatar(c.avatar, c.name, c.type === 'dm' ? 'visitor' : '') +
      '<div class="sk-convo-main">' +
        '<div class="sk-convo-row">' +
          '<span class="sk-convo-name">' + escapeHtml(c.name) + '</span>' +
          verified + badge + typeBadge + unreadDot +
          '<span class="sk-convo-time">' + _tAgo(c.lastTime) + '</span>' +
        '</div>' +
        '<p class="sk-convo-subject">' + escapeHtml(c.subject) + '</p>' +
        '<p class="sk-convo-preview">' + escapeHtml(c.lastMsg || '') + '</p>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function openConversation(type, id) {
  var c = _allConvos.find(function (x) { return x.type === type && x.id === id; });
  if (!c) return;
  _activeConvo = c;
  _renderConvoList(); // highlight active

  // On mobile, detail replaces the list. On desktop, keep the split view visible.
  var isMobile = window.innerWidth < 768;
  var listPanel = document.getElementById('chatListPanel');
  var detailPanel = document.getElementById('chatDetailPanel');
  listPanel.classList.remove('hidden', 'md:flex');
  if (isMobile) listPanel.classList.add('hidden-mobile');
  else listPanel.classList.remove('hidden-mobile');
  detailPanel.classList.remove('hidden', 'hidden-mobile');
  detailPanel.classList.add('flex');
  document.getElementById('chatEmptyState').classList.add('hidden');
  var activePanel = document.getElementById('chatActiveConvo');
  activePanel.classList.remove('hidden');
  activePanel.style.display = 'flex';

  if (type === 'thread') await _renderThreadConvo(c);
  else _renderDmConvo(c);
}

/* ---- Thread conversation ---- */
async function _renderThreadConvo(c) {
  try {
    var res = await apiRequest(API_BASE_URL + '/api/messaging/chat/' + c.id + '/');
    if (!res.ok) return;
    var thread = await res.json();
    c.raw = thread; // update raw
    var stu = thread.student_info || {};
    var stuAvatarUrl = resolveProfileImage(stu.profile_image_url);
    var verified = stu.student_id ? ' <i class="bi bi-patch-check-fill" style="color:var(--sk-primary)"></i>' : '';

    // Header
    var headerHtml =
      '<button onclick="_backToList()" class="sk-btn sk-btn-ghost sk-btn-icon sk-chat-back" title="Back"><i class="bi bi-arrow-left"></i></button>' +
      _chatHeaderAvatar(stuAvatarUrl, stu.username || 'Student') +
      '<div class="sk-chat-header-main">' +
        '<p class="sk-chat-header-title">' + escapeHtml(stu.username || 'Student') + verified + '</p>' +
        '<p class="sk-chat-header-meta">' + escapeHtml(thread.subject) + ' · ' + _statusLabel(thread.status) + '</p>' +
      '</div>' +
      '<div class="sk-chat-header-actions">' +
        (stu.student_id ? '<button onclick="_viewProfile(' + JSON.stringify(JSON.stringify(stu)).replace(/"/g, '&quot;') + ')" class="sk-btn sk-btn-secondary sk-btn-sm"><i class="bi bi-person-circle"></i> Profile</button>' : '') +
        (thread.status === 'PENDING' ? '<button onclick="_acceptThread(' + thread.id + ')" class="sk-btn sk-btn-success sk-btn-sm"><i class="bi bi-check-lg"></i> Accept</button>' : '') +
        (thread.status !== 'CLOSED' ? '<button onclick="_closeThread(' + thread.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Close"><i class="bi bi-x-circle"></i></button>' : '') +
        '<button onclick="_deleteThreadInline(' + thread.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Delete"><i class="bi bi-trash"></i></button>' +
      '</div>';
    document.getElementById('chatConvoHeader').innerHTML = headerHtml;

    // Messages
    var msgs = (thread.messages || []).map(function (m) {
      var isMe = m.sender_role === 'FACULTY';
      return _renderBubble(m.body, m.sender_name, m.created_at, isMe);
    }).join('');
    if (!msgs) msgs = '<div class="sk-convo-empty"><p>No messages yet</p></div>';
    if (thread.status === 'PENDING') msgs = '<div class="sk-chat-system warning"><i class="bi bi-hourglass-split"></i> Pending - accept to start chatting.</div>' + msgs;
    if (thread.status === 'CLOSED') msgs += '<div class="sk-chat-system"><i class="bi bi-lock"></i> Closed' + (thread.closed_by_name ? ' by ' + escapeHtml(thread.closed_by_name) : '') + '</div>';
    document.getElementById('chatConvoMessages').innerHTML = msgs;

    // Reply bar
    if (thread.status === 'ACTIVE') {
      document.getElementById('chatReplyBar').innerHTML =
        '<div class="sk-chat-reply-form">' +
          '<input type="text" id="replyInput" placeholder="Type a reply..." class="sk-input" onkeydown="if(event.key===\'Enter\')_sendThreadReply(' + thread.id + ')">' +
          '<button onclick="_sendThreadReply(' + thread.id + ')" class="sk-btn sk-btn-primary"><i class="bi bi-send"></i></button>' +
        '</div>';
    } else if (thread.status === 'PENDING') {
      document.getElementById('chatReplyBar').innerHTML = '<p class="sk-chat-header-meta" style="text-align:center">Accept this chat to reply.</p>';
    } else {
      document.getElementById('chatReplyBar').innerHTML = '<p class="sk-chat-header-meta" style="text-align:center">This conversation is closed.</p>';
    }
    _scrollMsgs();
  } catch (e) { console.error(e); }
}

/* ---- DM conversation ---- */
function _renderDmConvo(c) {
  var dm = c.raw;
  var verified = c.isRegistered ? ' <i class="bi bi-patch-check-fill" style="color:var(--sk-primary)"></i>' : '';

  // Mark as read
  if (!dm.is_read) {
    apiRequest(API_BASE_URL + '/api/messaging/' + dm.id + '/', {
      method: 'PATCH', body: JSON.stringify({ is_read: true })
    }).then(function () { c.unread = false; _updateBadge(); _renderConvoList(); });
  }

  // Header
  document.getElementById('chatConvoHeader').innerHTML =
    '<button onclick="_backToList()" class="sk-btn sk-btn-ghost sk-btn-icon sk-chat-back" title="Back"><i class="bi bi-arrow-left"></i></button>' +
    _chatHeaderAvatar('', c.name, 'visitor') +
    '<div class="sk-chat-header-main">' +
      '<p class="sk-chat-header-title">' + escapeHtml(c.name) + verified + ' <span class="sk-convo-type visitor">Visitor</span></p>' +
      '<p class="sk-chat-header-meta">' + escapeHtml(c.email) + (c.subject ? ' · ' + escapeHtml(c.subject) : '') + '</p>' +
    '</div>' +
    '<div class="sk-chat-header-actions">' +
      (c.isRegistered ? '<button onclick="_viewProfile(' + JSON.stringify(JSON.stringify({username:c.name,email:c.email,student_id:c.studentId})).replace(/"/g,'&quot;') + ')" class="sk-btn sk-btn-secondary sk-btn-sm"><i class="bi bi-person-circle"></i> Profile</button>' : '') +
      '<button onclick="_closeDmInline(' + dm.id + ')" class="sk-btn sk-btn-secondary sk-btn-sm"><i class="bi bi-check-circle"></i> Close</button>' +
      '<button onclick="_deleteDmInline(' + dm.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger"><i class="bi bi-trash"></i></button>' +
    '</div>';

  // Messages
  var replies = _parseReplies(dm.reply_body);
  var msgsHtml = _renderBubble(dm.body, dm.sender_name, dm.created_at, false);
  replies.forEach(function (r) {
    msgsHtml += _renderBubble(r.body, r.by === 'broadcaster' ? 'You' : dm.sender_name, r.at, r.by === 'broadcaster');
  });
  document.getElementById('chatConvoMessages').innerHTML = msgsHtml;

  // Reply bar
  if (!dm.is_closed) {
    document.getElementById('chatReplyBar').innerHTML =
      '<div class="sk-chat-reply-form">' +
        '<input type="text" id="replyInput" placeholder="Type a reply..." class="sk-input" onkeydown="if(event.key===\'Enter\')_sendDmReply(' + dm.id + ')">' +
        '<button onclick="_sendDmReply(' + dm.id + ')" class="sk-btn sk-btn-primary"><i class="bi bi-send"></i></button>' +
      '</div>';
  } else {
    document.getElementById('chatReplyBar').innerHTML = '<p class="sk-chat-header-meta" style="text-align:center">This conversation is closed.</p>';
  }
  _scrollMsgs();
}

/* ---- Actions ---- */
async function _sendThreadReply(threadId) {
  var input = document.getElementById('replyInput');
  if (!input || !input.value.trim()) return;
  var body = input.value.trim();
  input.disabled = true;
  try {
    var res = await apiRequest(API_BASE_URL + '/api/messaging/chat/' + threadId + '/reply/', {
      method: 'POST', body: JSON.stringify({ body: body })
    });
    if (res.ok) { await loadUnifiedInbox(); openConversation('thread', threadId); }
    else { var e = await res.json(); await skNotify(e.error || 'Failed', { variant: 'error' }); input.disabled = false; }
  } catch (e) { input.disabled = false; }
}

async function _sendDmReply(dmId) {
  var input = document.getElementById('replyInput');
  if (!input || !input.value.trim()) return;
  var body = input.value.trim();
  input.disabled = true;
  try {
    var res = await apiRequest(API_BASE_URL + '/api/messaging/' + dmId + '/reply/', {
      method: 'POST', body: JSON.stringify({ reply_body: body })
    });
    if (res.ok) { await loadUnifiedInbox(); openConversation('dm', dmId); }
    else { await skNotify('Failed to send reply', { variant: 'error' }); input.disabled = false; }
  } catch (e) { input.disabled = false; }
}

async function _acceptThread(id) {
  try {
    var res = await apiRequest(API_BASE_URL + '/api/messaging/chat/' + id + '/accept/', { method: 'POST' });
    if (res.ok) { await skNotify('Chat accepted!', { variant: 'success' }); await loadUnifiedInbox(); openConversation('thread', id); }
  } catch (e) { await skNotify('Failed to accept', { variant: 'error' }); }
}

async function _closeThread(id) {
  var ok = await skConfirm('Close this chat thread?', { title: 'Close Chat', confirmText: 'Close', danger: true });
  if (!ok) return;
  try {
    var res = await apiRequest(API_BASE_URL + '/api/messaging/chat/' + id + '/close/', { method: 'POST' });
    if (res.ok) { await skNotify('Thread closed.', { variant: 'success' }); await loadUnifiedInbox(); openConversation('thread', id); }
  } catch (e) { await skNotify('Failed', { variant: 'error' }); }
}

async function _closeDmInline(id) {
  var ok = await skConfirm('Close this DM?', { title: 'Close', confirmText: 'Close' });
  if (!ok) return;
  try {
    await apiRequest(API_BASE_URL + '/api/messaging/' + id + '/close-dm/', { method: 'POST' });
    await skNotify('DM closed.', { variant: 'success' }); await loadUnifiedInbox(); _backToList();
  } catch (e) {}
}

async function _deleteDmInline(id) {
  var ok = await skConfirm('Delete this message?', { title: 'Delete', confirmText: 'Delete', danger: true });
  if (!ok) return;
  try {
    await apiRequest(API_BASE_URL + '/api/messaging/' + id + '/delete/', { method: 'DELETE' });
    await skNotify('Deleted.', { variant: 'success' }); _activeConvo = null; await loadUnifiedInbox(); _backToList();
  } catch (e) {}
}

async function _deleteThreadInline(id) {
  var c = _allConvos.find(function (x) { return x.type === 'thread' && x.id === id; });
  var msg = (c && c.status !== 'CLOSED') ? 'This will close and delete this chat thread and all its messages.' : 'Delete this chat thread and all its messages?';
  var ok = await skConfirm(msg, { title: 'Delete Chat', confirmText: 'Delete', danger: true });
  if (!ok) return;
  try {
    await apiRequest(API_BASE_URL + '/api/messaging/chat/' + id + '/delete/', { method: 'DELETE' });
    await skNotify('Thread deleted.', { variant: 'success' }); _activeConvo = null; await loadUnifiedInbox(); _backToList();
  } catch (e) {}
}

async function _closeAndDeleteAll() {
  var ok = await skConfirm('This will close all open chats and permanently delete ALL chat threads. This cannot be undone.', { title: 'Close & Delete All', confirmText: 'Delete All', danger: true });
  if (!ok) return;
  try {
    var res = await apiRequest(API_BASE_URL + '/api/messaging/chat/delete-all/', { method: 'POST' });
    if (res.ok) {
      var data = await res.json();
      await skNotify(data.message || 'All threads deleted.', { variant: 'success' });
      _activeConvo = null; await loadUnifiedInbox(); _backToList();
    }
  } catch (e) { await skNotify('Failed', { variant: 'error' }); }
}

function _viewProfile(jsonStr) {
  var s = JSON.parse(jsonStr);
  var badge = s.student_id ? '<span class="sk-profile-pill" style="margin-top:0.75rem"><i class="bi bi-patch-check-fill"></i>Verified</span>' : '';
  skModal.open(
    '<div style="text-align:center">' +
      '<div class="sk-chat-header-avatar" style="width:64px;height:64px;margin:0 auto;font-size:1.5rem">' + (s.username||'S').charAt(0).toUpperCase() + '</div>' +
      '<h3 class="sk-profile-summary-title" style="margin-top:0.75rem">' + escapeHtml(s.username||'User') + '</h3>' +
      (s.email ? '<p class="sk-profile-summary-subtitle">' + escapeHtml(s.email) + '</p>' : '') +
      (s.student_id ? '<p class="sk-chat-header-meta">ID: ' + escapeHtml(s.student_id) + '</p>' : '') +
      badge + '</div>',
    { title: 'Profile', maxWidth: 'max-w-sm' }
  );
}

function _backToList() {
  var isMobile = window.innerWidth < 768;
  var listPanel = document.getElementById('chatListPanel');
  var detailPanel = document.getElementById('chatDetailPanel');
  listPanel.classList.remove('hidden', 'hidden-mobile', 'md:flex');
  listPanel.classList.add('flex');
  detailPanel.classList.remove('hidden');
  detailPanel.classList.add('flex');
  if (isMobile) detailPanel.classList.add('hidden-mobile');
  else detailPanel.classList.remove('hidden-mobile');
  document.getElementById('chatEmptyState').classList.remove('hidden');
  var activePanel = document.getElementById('chatActiveConvo');
  activePanel.classList.add('hidden');
  activePanel.style.display = 'none';
}

/* ---- Helpers ---- */
function _renderBubble(body, name, time, isMe) {
  var side = isMe ? 'sent' : 'received';
  return '<div class="sk-chat-message ' + side + '">' +
    '<div class="sk-chat-bubble ' + side + '">' +
      '<div>' + escapeHtml(body) + '</div>' +
    '</div>' +
    '<span class="sk-chat-meta">' + escapeHtml(name) + ' · ' + _tAgo(time) + '</span>' +
  '</div>';
}

function _statusLabel(s) {
  if (s === 'PENDING') return '<span style="color:#b45309">Awaiting</span>';
  if (s === 'ACTIVE') return '<span style="color:var(--sk-success)">Open</span>';
  return '<span style="color:var(--sk-text-placeholder)">Closed</span>';
}

function _scrollMsgs() {
  setTimeout(function () {
    var el = document.getElementById('chatConvoMessages');
    if (el) el.scrollTop = el.scrollHeight;
  }, 80);
}

function _tAgo(d) {
  if (!d) return '';
  var diff = Math.floor((Date.now() - new Date(d)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'd';
}

function _parseReplies(replyBody) {
  if (!replyBody) return [];
  try {
    var parsed = JSON.parse(replyBody);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  return [{ body: replyBody, by: 'broadcaster', at: null }];
}

function _updateBadge() {
  var count = _allConvos.filter(function (c) { return c.unread; }).length;
  var el = document.getElementById('unreadBadge');
  if (el) {
    el.textContent = count;
    if (count > 0) el.classList.remove('hidden');
    else el.classList.add('hidden');
  }
  var dmEl = document.getElementById('unreadDmCount');
  if (dmEl) dmEl.textContent = count;
}

// Keep old function name for compatibility with analytics click
function loadInbox() { loadUnifiedInbox(); }
function loadUnreadCount() { _updateBadge(); }
