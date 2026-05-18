/* dashboard-chat.js — Unified Messages panel (threads + DMs) */
var _allConvos = [];
var _chatFilter = 'all';
var _activeConvo = null;

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
      email: info.email || '', avatar: info.profile_image_url || '',
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
    if (f === _chatFilter) { b.className = 'chat-filter-btn text-[10px] px-2 py-1 rounded-md font-bold border border-blue-300 bg-blue-50 text-blue-600 transition'; }
    else { b.className = 'chat-filter-btn text-[10px] px-2 py-1 rounded-md font-bold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition'; }
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
    el.innerHTML = '<div class="py-16 text-center"><i class="bi bi-chat-square text-3xl text-gray-200 mb-2 block"></i><p class="text-xs text-gray-400">No conversations found</p></div>';
    return;
  }

  el.innerHTML = items.map(function (c) {
    var isActive = _activeConvo && _activeConvo.type === c.type && _activeConvo.id === c.id;
    var initial = c.name.charAt(0).toUpperCase();
    var color = c.type === 'thread' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600';
    var badge = '';
    if (c.type === 'thread') {
      if (c.status === 'PENDING') badge = '<span class="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" title="Awaiting"></span>';
      else if (c.status === 'ACTIVE') badge = '<span class="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" title="Open"></span>';
      else badge = '<span class="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" title="Closed"></span>';
    }
    var verified = c.studentId ? '<i class="bi bi-patch-check-fill text-blue-500 text-[9px]"></i>' : '';
    var typeBadge = c.type === 'dm' ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-500 border border-orange-100 font-bold">Visitor</span>' : '';
    var unreadDot = c.unread ? '<span class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>' : '';
    return '<div class="flex gap-2.5 px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-blue-50/50 transition-colors ' + (isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : '') + '" onclick="openConversation(\'' + c.type + '\',' + c.id + ')">' +
      '<div class="w-9 h-9 rounded-full ' + color + ' flex items-center justify-center text-sm font-bold flex-shrink-0">' + initial + '</div>' +
      '<div class="flex-1 min-w-0">' +
        '<div class="flex items-center gap-1.5">' +
          '<span class="text-xs font-semibold text-gray-800 truncate">' + escapeHtml(c.name) + '</span>' +
          verified + badge + typeBadge + unreadDot +
          '<span class="text-[10px] text-gray-400 ml-auto flex-shrink-0">' + _tAgo(c.lastTime) + '</span>' +
        '</div>' +
        '<p class="text-[11px] text-gray-500 truncate font-medium">' + escapeHtml(c.subject) + '</p>' +
        '<p class="text-[10px] text-gray-400 truncate">' + escapeHtml(c.lastMsg || '') + '</p>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function openConversation(type, id) {
  var c = _allConvos.find(function (x) { return x.type === type && x.id === id; });
  if (!c) return;
  _activeConvo = c;
  _renderConvoList(); // highlight active

  // On mobile, hide list panel and show detail
  document.getElementById('chatListPanel').classList.add('hidden', 'md:flex');
  document.getElementById('chatDetailPanel').classList.remove('hidden');
  document.getElementById('chatDetailPanel').classList.add('flex');
  document.getElementById('chatEmptyState').classList.add('hidden');
  document.getElementById('chatActiveConvo').classList.remove('hidden');

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
    var verified = stu.student_id ? ' <i class="bi bi-patch-check-fill text-blue-500 text-xs"></i>' : '';

    // Header
    var headerHtml =
      '<button onclick="_backToList()" class="md:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 mr-1"><i class="bi bi-arrow-left"></i></button>' +
      '<div class="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">' + (stu.username || 'S').charAt(0).toUpperCase() + '</div>' +
      '<div class="flex-1 min-w-0">' +
        '<p class="text-sm font-bold text-gray-800 truncate">' + escapeHtml(stu.username || 'Student') + verified + '</p>' +
        '<p class="text-[10px] text-gray-400 truncate">' + escapeHtml(thread.subject) + ' · ' + _statusLabel(thread.status) + '</p>' +
      '</div>' +
      '<div class="flex items-center gap-2 flex-shrink-0">' +
        (stu.student_id ? '<button onclick="_viewProfile(' + JSON.stringify(JSON.stringify(stu)).replace(/"/g, '&quot;') + ')" class="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-blue-500 hover:bg-blue-50"><i class="bi bi-person-circle mr-0.5"></i>Profile</button>' : '') +
        (thread.status === 'PENDING' ? '<button onclick="_acceptThread(' + thread.id + ')" class="text-[10px] px-2.5 py-1 rounded-lg bg-green-500 text-white hover:bg-green-600 font-bold"><i class="bi bi-check-lg mr-0.5"></i>Accept</button>' : '') +
        (thread.status !== 'CLOSED' ? '<button onclick="_closeThread(' + thread.id + ')" class="text-[10px] px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50" title="Close"><i class="bi bi-x-circle"></i></button>' : '') +
        '<button onclick="_deleteThreadInline(' + thread.id + ')" class="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Delete"><i class="bi bi-trash"></i></button>' +
      '</div>';
    document.getElementById('chatConvoHeader').innerHTML = headerHtml;

    // Messages
    var msgs = (thread.messages || []).map(function (m) {
      var isMe = m.sender_role === 'FACULTY';
      return _renderBubble(m.body, m.sender_name, m.created_at, isMe);
    }).join('');
    if (!msgs) msgs = '<p class="text-center text-gray-300 text-xs py-8">No messages yet.</p>';
    if (thread.status === 'PENDING') msgs = '<div class="bg-yellow-50 text-yellow-700 text-xs font-medium px-4 py-2 rounded-xl border border-yellow-200 mb-3 text-center"><i class="bi bi-hourglass-split mr-1"></i>Pending — accept to start chatting.</div>' + msgs;
    if (thread.status === 'CLOSED') msgs += '<div class="bg-gray-50 text-gray-400 text-xs font-medium px-4 py-2 rounded-xl border border-gray-200 mt-3 text-center"><i class="bi bi-lock mr-1"></i>Closed' + (thread.closed_by_name ? ' by ' + escapeHtml(thread.closed_by_name) : '') + '</div>';
    document.getElementById('chatConvoMessages').innerHTML = msgs;

    // Reply bar
    if (thread.status === 'ACTIVE') {
      document.getElementById('chatReplyBar').innerHTML =
        '<div class="flex gap-2">' +
          '<input type="text" id="replyInput" placeholder="Type a reply..." class="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" onkeydown="if(event.key===\'Enter\')_sendThreadReply(' + thread.id + ')">' +
          '<button onclick="_sendThreadReply(' + thread.id + ')" class="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-600 transition shadow-sm"><i class="bi bi-send"></i></button>' +
        '</div>';
    } else if (thread.status === 'PENDING') {
      document.getElementById('chatReplyBar').innerHTML = '<p class="text-xs text-gray-400 text-center">Accept this chat to reply.</p>';
    } else {
      document.getElementById('chatReplyBar').innerHTML = '<p class="text-xs text-gray-400 text-center">This conversation is closed.</p>';
    }
    _scrollMsgs();
  } catch (e) { console.error(e); }
}

/* ---- DM conversation ---- */
function _renderDmConvo(c) {
  var dm = c.raw;
  var verified = c.isRegistered ? ' <i class="bi bi-patch-check-fill text-blue-500 text-xs"></i>' : '';

  // Mark as read
  if (!dm.is_read) {
    apiRequest(API_BASE_URL + '/api/messaging/' + dm.id + '/', {
      method: 'PATCH', body: JSON.stringify({ is_read: true })
    }).then(function () { c.unread = false; _updateBadge(); _renderConvoList(); });
  }

  // Header
  document.getElementById('chatConvoHeader').innerHTML =
    '<button onclick="_backToList()" class="md:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 mr-1"><i class="bi bi-arrow-left"></i></button>' +
    '<div class="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold flex-shrink-0">' + c.name.charAt(0).toUpperCase() + '</div>' +
    '<div class="flex-1 min-w-0">' +
      '<p class="text-sm font-bold text-gray-800 truncate">' + escapeHtml(c.name) + verified + ' <span class="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-500 border border-orange-100 font-bold">Visitor</span></p>' +
      '<p class="text-[10px] text-gray-400 truncate">' + escapeHtml(c.email) + (c.subject ? ' · ' + escapeHtml(c.subject) : '') + '</p>' +
    '</div>' +
    '<div class="flex items-center gap-2 flex-shrink-0">' +
      (c.isRegistered ? '<button onclick="_viewProfile(' + JSON.stringify(JSON.stringify({username:c.name,email:c.email,student_id:c.studentId})).replace(/"/g,'&quot;') + ')" class="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-blue-500 hover:bg-blue-50"><i class="bi bi-person-circle mr-0.5"></i>Profile</button>' : '') +
      '<button onclick="_closeDmInline(' + dm.id + ')" class="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:bg-yellow-50 hover:text-yellow-600"><i class="bi bi-check-circle mr-0.5"></i>Close</button>' +
      '<button onclick="_deleteDmInline(' + dm.id + ')" class="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500"><i class="bi bi-trash"></i></button>' +
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
      '<div class="flex gap-2">' +
        '<input type="text" id="replyInput" placeholder="Type a reply..." class="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" onkeydown="if(event.key===\'Enter\')_sendDmReply(' + dm.id + ')">' +
        '<button onclick="_sendDmReply(' + dm.id + ')" class="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition shadow-sm"><i class="bi bi-send"></i></button>' +
      '</div>';
  } else {
    document.getElementById('chatReplyBar').innerHTML = '<p class="text-xs text-gray-400 text-center">This conversation is closed.</p>';
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
      method: 'PATCH', body: JSON.stringify({ reply_body: body })
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
  var badge = s.student_id ? '<span class="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-semibold border border-blue-200 mt-2"><i class="bi bi-patch-check-fill"></i>Verified</span>' : '';
  skModal.open(
    '<div class="text-center">' +
      '<div class="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl mx-auto">' + (s.username||'S').charAt(0).toUpperCase() + '</div>' +
      '<h3 class="font-bold text-gray-800 text-lg mt-3">' + escapeHtml(s.username||'User') + '</h3>' +
      (s.email ? '<p class="text-sm text-gray-500 mt-1">' + escapeHtml(s.email) + '</p>' : '') +
      (s.student_id ? '<p class="text-sm text-gray-500 mt-1">ID: ' + escapeHtml(s.student_id) + '</p>' : '') +
      badge + '</div>',
    { title: 'Profile', maxWidth: 'max-w-sm' }
  );
}

function _backToList() {
  document.getElementById('chatListPanel').classList.remove('hidden', 'md:flex');
  document.getElementById('chatListPanel').classList.add('flex');
  document.getElementById('chatDetailPanel').classList.add('hidden');
  document.getElementById('chatDetailPanel').classList.remove('flex');
  document.getElementById('chatEmptyState').classList.remove('hidden');
  document.getElementById('chatActiveConvo').classList.add('hidden');
  // On desktop keep detail visible
  if (window.innerWidth >= 768) {
    document.getElementById('chatDetailPanel').classList.remove('hidden');
    document.getElementById('chatDetailPanel').classList.add('flex');
  }
}

/* ---- Helpers ---- */
function _renderBubble(body, name, time, isMe) {
  var align = isMe ? 'items-end' : 'items-start';
  var bg = isMe ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800';
  return '<div class="flex flex-col ' + align + ' mb-2.5">' +
    '<div class="' + bg + ' px-4 py-2.5 rounded-2xl max-w-[80%] shadow-sm">' +
      '<p class="text-sm leading-relaxed">' + escapeHtml(body) + '</p>' +
    '</div>' +
    '<span class="text-[10px] text-gray-400 mt-0.5 px-1">' + escapeHtml(name) + ' · ' + _tAgo(time) + '</span>' +
  '</div>';
}

function _statusLabel(s) {
  if (s === 'PENDING') return '<span class="text-yellow-600">Awaiting</span>';
  if (s === 'ACTIVE') return '<span class="text-green-600">Open</span>';
  return '<span class="text-gray-400">Closed</span>';
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
