/* student-chat.js — Split-panel chat UI for student dashboard */
var _stuThreads = [];
var _stuActiveThread = null;
var _stuLiveTimer = null;
var _stuLiveInFlight = false;
var _stuThreadListSignature = '';
var _stuActiveDetailSignature = '';
var STU_CHAT_LIVE_INTERVAL_MS = 3000;

function _stuSeenStorageKey() {
  var id = currentUser && currentUser.id ? currentUser.id : 'guest';
  return 'sk_student_chat_seen_' + id;
}

function _stuReadSeenMap() {
  try {
    var value = JSON.parse(localStorage.getItem(_stuSeenStorageKey()) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (e) {
    return {};
  }
}

function _stuWriteSeenMap(map) {
  localStorage.setItem(_stuSeenStorageKey(), JSON.stringify(map || {}));
}

function _stuUnreadSignature(thread) {
  var last = thread && thread.last_message ? thread.last_message : {};
  return [
    thread ? thread.id : '',
    last.sender || '',
    last.created_at || '',
    last.body || ''
  ].join(':');
}

function _stuThreadUnread(thread, seenMap) {
  var last = thread && thread.last_message;
  if (!last || !currentUser || !currentUser.id) return false;
  if (parseInt(last.sender, 10) === parseInt(currentUser.id, 10)) return false;
  return seenMap[String(thread.id)] !== _stuUnreadSignature(thread);
}

function _stuUpdateNavBadge() {
  var seen = _stuReadSeenMap();
  var count = _stuThreads.filter(function (thread) {
    return _stuThreadUnread(thread, seen);
  }).length;
  _stuSetNavBadge(count);
}

function _stuSetNavBadge(count) {
  var badge = document.getElementById('chatBadge');
  if (badge) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = count > 0 ? '' : 'none';
  }
  if (window.SKLayout && SKLayout.setNavBadge) SKLayout.setNavBadge('messages', count);
}

function _stuMarkThreadSeen(thread) {
  if (!thread || !currentUser || !currentUser.id) return;
  var seen = _stuReadSeenMap();
  seen[String(thread.id)] = _stuUnreadSignature(thread);
  _stuWriteSeenMap(seen);
  _stuUpdateNavBadge();
}

function _stuConvoAvatar(src, name) {
  var initial = (name || 'F').charAt(0).toUpperCase();
  if (src && src !== '../static/images/image.png') {
    return '<div class="sk-convo-avatar"><img src="' + src + '" alt="' + _esc(name || 'Faculty') + '"></div>';
  }
  return '<div class="sk-convo-avatar">' + initial + '</div>';
}

function _stuHeaderAvatar(src, name) {
  var initial = (name || 'F').charAt(0).toUpperCase();
  if (src && src !== '../static/images/image.png') {
    return '<div class="sk-chat-header-avatar"><img src="' + src + '" alt="' + _esc(name || 'Faculty') + '"></div>';
  }
  return '<div class="sk-chat-header-avatar">' + initial + '</div>';
}

function _stuStatusDot(status) {
  if (status === 'PENDING') return '<span class="sk-convo-dot pending"></span>';
  if (status === 'ACTIVE') return '<span class="sk-convo-dot active"></span>';
  return '<span class="sk-convo-dot"></span>';
}

function _stuAuthHeaders(extra) {
  var headers = Object.assign({}, extra || {});
  headers.Authorization = 'Bearer ' + localStorage.getItem('access_token');
  return headers;
}

function _stuListSignature(threads) {
  return (threads || []).map(function (t) {
    var last = t.last_message || {};
    return [t.id, t.status, t.last_activity_at, t.message_count, last.body || '', last.created_at || ''].join(':');
  }).join('|');
}

function _stuDetailSignature(thread) {
  return [
    thread.id,
    thread.status,
    thread.closed_by_name || '',
    thread.last_activity_at || '',
    (thread.messages || []).map(function (m) {
      return [m.id, m.sender, m.body, m.created_at].join(':');
    }).join('|')
  ].join('::');
}

function _stuMessagesTabActive() {
  var tab = document.getElementById('tab-messages');
  return !!tab && !tab.classList.contains('hidden') && document.visibilityState !== 'hidden';
}

async function _stuFetchThreads() {
  var res = await fetch(API_BASE_URL + '/api/messaging/chat/threads/', {
    headers: _stuAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

async function loadChatThreads(options) {
  options = options || {};
  try {
    var threads = await _stuFetchThreads();
    if (options.badgeOnly || !_stuMessagesTabActive()) {
      var seen = _stuReadSeenMap();
      var count = threads.filter(function (thread) {
        return _stuThreadUnread(thread, seen);
      }).length;
      _stuSetNavBadge(count);
      return threads;
    }
    _stuThreads = threads;
    _stuThreadListSignature = _stuListSignature(threads);
    _stuUpdateNavBadge();
    _stuRenderList();
    return _stuThreads;
  } catch (e) {
    if (!options.silent) {
      document.getElementById('stuConvoList').innerHTML = '<div class="sk-convo-empty"><i class="bi bi-exclamation-triangle"></i><p>Failed to load conversations.</p></div>';
    }
    return _stuThreads;
  }
}

async function refreshStudentChatBadge() {
  try {
    var threads = await _stuFetchThreads();
    var seen = _stuReadSeenMap();
    var count = threads.filter(function (thread) {
      return _stuThreadUnread(thread, seen);
    }).length;
    _stuSetNavBadge(count);
  } catch (e) {}
}

function clearStudentChatThreads() {
  stopStudentChatLive();
  _stuThreads = [];
  _stuActiveThread = null;
  _stuThreadListSignature = '';
  _stuActiveDetailSignature = '';
  var list = document.getElementById('stuConvoList');
  if (list) list.innerHTML = '';
  var empty = document.getElementById('stuChatEmpty');
  if (empty) empty.style.display = 'flex';
  var active = document.getElementById('stuChatActive');
  if (active) active.style.display = 'none';
  ['stuChatHeader', 'stuChatMessages', 'stuChatReplyBar'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

function _stuFilterList() { _stuRenderList(); }

function _stuRenderList() {
  var el = document.getElementById('stuConvoList');
  var search = (document.getElementById('stuChatSearch') || {}).value || '';
  search = search.toLowerCase();

  var statusOrder = { 'ACTIVE': 0, 'PENDING': 1, 'CLOSED': 2 };
  var sorted = _stuThreads.slice().sort(function (a, b) {
    var so = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
    if (so !== 0) return so;
    return new Date(b.last_activity_at) - new Date(a.last_activity_at);
  });

  if (search) {
    sorted = sorted.filter(function (t) {
      var fac = t.faculty_info || {};
      return (fac.username || '').toLowerCase().indexOf(search) !== -1 || t.subject.toLowerCase().indexOf(search) !== -1;
    });
  }

  if (!sorted.length) {
    el.innerHTML = '<div class="sk-convo-empty"><i class="bi bi-chat-square"></i><p>No conversations yet</p><p>Start one from a faculty card</p></div>';
    return;
  }

  el.innerHTML = sorted.map(function (t) {
    var fac = t.faculty_info || {};
    var isActive = _stuActiveThread && _stuActiveThread.id === t.id;
    var badge = _stuStatusDot(t.status);
    var unreadDot = _stuThreadUnread(t, _stuReadSeenMap()) ? '<span class="sk-convo-dot unread" title="New message"></span>' : '';
    var lastMsg = t.last_message ? t.last_message.body : '';
    var facAvatarUrl = resolveProfileImage(fac.profile_image_url);
    return '<div class="sk-convo-item ' + (isActive ? 'active' : '') + '" onclick="stuOpenThread(' + t.id + ')">' +
      _stuConvoAvatar(facAvatarUrl, fac.username || 'Faculty') +
      '<div class="sk-convo-main">' +
        '<div class="sk-convo-row">' +
          '<span class="sk-convo-name">' + _esc(fac.username || 'Faculty') + '</span>' +
          badge + unreadDot +
          '<span class="sk-convo-time">' + _stuAgo(t.last_activity_at) + '</span>' +
        '</div>' +
        '<p class="sk-convo-subject">' + _esc(t.subject) + '</p>' +
        '<p class="sk-convo-preview">' + _esc(lastMsg) + '</p>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function stuOpenThread(threadId) {
  // Show detail panel, hide empty state
  var isMobile = window.innerWidth < 768;
  var listPanel = document.getElementById('stuChatListPanel');
  var detailPanel = document.getElementById('stuChatDetailPanel');
  listPanel.classList.remove('hidden', 'md:flex');
  if (isMobile) listPanel.classList.add('hidden-mobile');
  else listPanel.classList.remove('hidden-mobile');
  detailPanel.classList.remove('hidden', 'hidden-mobile');
  detailPanel.classList.add('flex');
  document.getElementById('stuChatEmpty').classList.add('hidden');
  var activePanel = document.getElementById('stuChatActive');
  activePanel.classList.remove('hidden');
  activePanel.style.display = 'flex';

  try {
    var res = await fetch(API_BASE_URL + '/api/messaging/chat/' + threadId + '/', {
      headers: _stuAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed');
    var thread = await res.json();
    _stuActiveThread = thread;
    _stuActiveDetailSignature = _stuDetailSignature(thread);
    _stuMarkThreadSeen(thread);
    _stuRenderList(); // highlight
    _stuRenderDetail(thread);
  } catch (e) {
    showNotifyModal('Failed to open conversation.', 'error');
  }
}

function _stuRenderDetail(thread, options) {
  options = options || {};
  var fac = thread.faculty_info || {};
  var messages = thread.messages || [];
  var oldInput = document.getElementById('stuReplyInput');
  var oldValue = oldInput && options.preserveReply ? oldInput.value : '';
  var hadFocus = oldInput && document.activeElement === oldInput;
  var msgBox = document.getElementById('stuChatMessages');
  var shouldStick = !msgBox || (msgBox.scrollHeight - msgBox.scrollTop - msgBox.clientHeight < 96);

  // Header
  var facHeaderAvatar = resolveProfileImage(fac.profile_image_url);
  var headerHtml =
    '<button onclick="_stuBackToList()" class="sk-btn sk-btn-ghost sk-btn-icon sk-chat-back" title="Back"><i class="bi bi-arrow-left"></i></button>' +
    _stuHeaderAvatar(facHeaderAvatar, fac.username || 'Faculty') +
    '<div class="sk-chat-header-main">' +
      '<p class="sk-chat-header-title">' + _esc(fac.username || 'Faculty') + '</p>' +
      '<p class="sk-chat-header-meta">' + _esc(thread.subject) + ' · ' + _stuStatusLabel(thread.status) + '</p>' +
    '</div>' +
    '<div class="sk-chat-header-actions">' +
      (fac.slug ? '<a href="../broadcast/message.html?user=' + fac.slug + '" target="_blank" class="sk-btn sk-btn-secondary sk-btn-sm"><i class="bi bi-box-arrow-up-right"></i> Profile</a>' : '') +
      (thread.status !== 'CLOSED' ? '<button onclick="_stuCloseThread(' + thread.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Close"><i class="bi bi-x-circle"></i></button>' : '') +
      '<button onclick="_stuDeleteThread(' + thread.id + ')" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Delete"><i class="bi bi-trash"></i></button>' +
    '</div>';
  document.getElementById('stuChatHeader').innerHTML = headerHtml;

  // Messages
  var msgsHtml = '';
  if (thread.status === 'PENDING') {
    msgsHtml += '<div class="sk-chat-system warning"><i class="bi bi-hourglass-split"></i> Waiting for faculty to accept this chat.</div>';
  }
  msgsHtml += messages.map(function (m) {
    var isMe = m.sender === (currentUser ? currentUser.id : null);
    var side = isMe ? 'sent' : 'received';
    return '<div class="sk-chat-message ' + side + '">' +
      '<div class="sk-chat-bubble ' + side + '">' +
        '<div>' + _esc(m.body) + '</div>' +
      '</div>' +
      '<span class="sk-chat-meta">' + _esc(m.sender_name) + ' · ' + _stuAgo(m.created_at) + '</span>' +
    '</div>';
  }).join('');
  if (!messages.length && thread.status !== 'PENDING') msgsHtml += '<div class="sk-convo-empty"><p>No messages yet</p></div>';
  if (thread.status === 'CLOSED') {
    var closedBy = thread.closed_by_name || 'System (inactivity)';
    msgsHtml += '<div class="sk-chat-system"><i class="bi bi-lock"></i> Closed by ' + _esc(closedBy) + '</div>';
  }
  document.getElementById('stuChatMessages').innerHTML = msgsHtml;

  // Reply bar
  var canReply = thread.status !== 'CLOSED';
  if (canReply) {
    document.getElementById('stuChatReplyBar').innerHTML =
      '<div class="sk-chat-reply-form">' +
        '<input type="text" id="stuReplyInput" placeholder="Type a message..." class="sk-input" onkeydown="if(event.key===\'Enter\')_stuSendReply(' + thread.id + ')">' +
        '<button onclick="_stuSendReply(' + thread.id + ')" class="sk-btn sk-btn-primary"><i class="bi bi-send"></i></button>' +
      '</div>';
    if (oldValue) {
      var nextInput = document.getElementById('stuReplyInput');
      if (nextInput) {
        nextInput.value = oldValue;
        if (hadFocus) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      }
    }
  } else {
    document.getElementById('stuChatReplyBar').innerHTML = '<p class="sk-chat-header-meta" style="text-align:center">This conversation is closed.</p>';
  }

  // Scroll to bottom
  if (shouldStick || options.forceScroll) setTimeout(function () {
    var el = document.getElementById('stuChatMessages');
    if (el) el.scrollTop = el.scrollHeight;
  }, 80);
}

async function _stuRefreshActiveThreadLive() {
  if (!_stuActiveThread || !_stuMessagesTabActive()) return;
  var res = await fetch(API_BASE_URL + '/api/messaging/chat/' + _stuActiveThread.id + '/', {
    headers: _stuAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed');
  var thread = await res.json();
  var sig = _stuDetailSignature(thread);
  if (sig === _stuActiveDetailSignature) return;
  _stuActiveThread = thread;
  _stuActiveDetailSignature = sig;
  _stuMarkThreadSeen(thread);
  _stuRenderList();
  _stuRenderDetail(thread, { preserveReply: true });
}

function _stuScheduleLiveTick() {
  if (_stuLiveTimer) clearTimeout(_stuLiveTimer);
  if (!_stuMessagesTabActive()) return;
  _stuLiveTimer = setTimeout(_stuLiveTick, STU_CHAT_LIVE_INTERVAL_MS);
}

async function _stuLiveTick() {
  if (!_stuMessagesTabActive()) {
    stopStudentChatLive();
    return;
  }
  if (window.SKBackendStatus && window.SKBackendStatus.getState && window.SKBackendStatus.getState() === 'offline') {
    _stuScheduleLiveTick();
    return;
  }
  if (_stuLiveInFlight) {
    _stuScheduleLiveTick();
    return;
  }
  _stuLiveInFlight = true;
  try {
    var threads = await _stuFetchThreads();
    var sig = _stuListSignature(threads);
    if (sig !== _stuThreadListSignature) {
      _stuThreads = threads;
      _stuThreadListSignature = sig;
      _stuUpdateNavBadge();
      _stuRenderList();
    }
    await _stuRefreshActiveThreadLive();
  } catch (e) {
    // The global backend banner handles the visible connection state.
  } finally {
    _stuLiveInFlight = false;
    _stuScheduleLiveTick();
  }
}

function startStudentChatLive() {
  if (!_stuMessagesTabActive()) return;
  _stuScheduleLiveTick();
}

function stopStudentChatLive() {
  if (_stuLiveTimer) clearTimeout(_stuLiveTimer);
  _stuLiveTimer = null;
}

async function _stuSendReply(threadId) {
  var input = document.getElementById('stuReplyInput');
  if (!input || !input.value.trim()) return;
  var body = input.value.trim();
  input.disabled = true;
  try {
    var res = await fetch(API_BASE_URL + '/api/messaging/chat/' + threadId + '/reply/', {
      method: 'POST',
      headers: _stuAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ body: body })
    });
    if (!res.ok) { var err = await res.json(); showNotifyModal(err.error || 'Failed', 'error'); input.disabled = false; return; }
    await loadChatThreads();
    stuOpenThread(threadId);
  } catch (e) { input.disabled = false; }
}

async function _stuCloseThread(threadId) {
  var ok = await skConfirm('Close this chat thread? No more messages can be sent.', { title: 'Close Chat', confirmText: 'Close', danger: true });
  if (!ok) return;
  try {
    var res = await fetch(API_BASE_URL + '/api/messaging/chat/' + threadId + '/close/', {
      method: 'POST', headers: _stuAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed');
    showNotifyModal('Chat closed.', 'success');
    await loadChatThreads();
    stuOpenThread(threadId);
  } catch (e) { showNotifyModal('Failed to close.', 'error'); }
}

async function _stuDeleteThread(threadId) {
  var isOpen = _stuActiveThread && _stuActiveThread.status !== 'CLOSED';
  var msg = isOpen ? 'This will close and delete this chat and all messages.' : 'Delete this chat and all messages?';
  var ok = await skConfirm(msg, { title: 'Delete Chat', confirmText: 'Delete', danger: true });
  if (!ok) return;
  try {
    var res = await fetch(API_BASE_URL + '/api/messaging/chat/' + threadId + '/delete/', {
      method: 'DELETE', headers: _stuAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed');
    showNotifyModal('Chat deleted.', 'success');
    _stuActiveThread = null; await loadChatThreads(); _stuBackToList();
  } catch (e) { showNotifyModal('Failed to delete.', 'error'); }
}

async function _stuCloseAndDeleteAll() {
  var ok = await skConfirm('This will close all open chats and permanently delete ALL your chat threads. This cannot be undone.', { title: 'Close & Delete All', confirmText: 'Delete All', danger: true });
  if (!ok) return;
  try {
    var res = await fetch(API_BASE_URL + '/api/messaging/chat/delete-all/', {
      method: 'POST', headers: _stuAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed');
    var data = await res.json();
    showNotifyModal(data.message || 'All threads deleted.', 'success');
    _stuActiveThread = null; await loadChatThreads(); _stuBackToList();
  } catch (e) { showNotifyModal('Failed.', 'error'); }
}

function _stuBackToList() {
  var isMobile = window.innerWidth < 768;
  var listPanel = document.getElementById('stuChatListPanel');
  var detailPanel = document.getElementById('stuChatDetailPanel');
  listPanel.classList.remove('hidden', 'hidden-mobile', 'md:flex');
  listPanel.classList.add('flex');
  detailPanel.classList.remove('hidden');
  detailPanel.classList.add('flex');
  if (isMobile) detailPanel.classList.add('hidden-mobile');
  else detailPanel.classList.remove('hidden-mobile');
  document.getElementById('stuChatEmpty').classList.remove('hidden');
  var activePanel = document.getElementById('stuChatActive');
  activePanel.classList.add('hidden');
  activePanel.style.display = 'none';
}

// Called from student-dashboard.js faculty cards
async function initiateNewChat(facultyId, facultySlug, facultyName) {
  // Check for existing thread first
  try {
    var checkRes = await fetch(API_BASE_URL + '/api/messaging/chat/check/' + facultyId + '/', {
      headers: _stuAuthHeaders()
    });
    var checkData = await checkRes.json();
    if (checkData.has_thread) {
      if (typeof updateFacultyOpenChat === 'function') updateFacultyOpenChat(facultyId, checkData);
      _switchToMessagesTab();
      setTimeout(function () { stuOpenThread(checkData.thread_id); }, 300);
      return;
    }
  } catch (e) {}

  // Show initiation form in a modal
  var formHtml =
    '<p style="font-size:var(--sk-text-sm);color:var(--sk-text-secondary);margin-bottom:1rem">Start a conversation with <strong>' + _esc(facultyName) + '</strong>.</p>' +
    '<input type="text" id="chatSubjectInput" placeholder="Subject (e.g. Office hours query)" class="sk-input" style="margin-bottom:0.75rem">' +
    '<textarea id="chatBodyInput" placeholder="Your message..." class="sk-textarea" rows="3" style="margin-bottom:0.75rem"></textarea>' +
    '<button onclick="_submitNewChat(' + facultyId + ')" class="sk-btn sk-btn-primary" style="width:100%"><i class="bi bi-send"></i> Send</button>';
  skModal.open(formHtml, { title: 'New Chat' });
}

async function _submitNewChat(facultyId) {
  var subject = document.getElementById('chatSubjectInput').value.trim();
  var body = document.getElementById('chatBodyInput').value.trim();
  if (!subject) { showNotifyModal('Subject is required.', 'error'); return; }
  if (!body) { showNotifyModal('Message is required.', 'error'); return; }

  try {
    var res = await fetch(API_BASE_URL + '/api/messaging/chat/initiate/', {
      method: 'POST',
      headers: _stuAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ faculty_id: facultyId, subject: subject, body: body })
    });
    if (!res.ok) {
      var err = await res.json();
      if (err.thread_id) { skModal.closeAll(); _switchToMessagesTab(); setTimeout(function () { stuOpenThread(err.thread_id); }, 300); return; }
      throw new Error(err.error || 'Failed');
    }
    var thread = await res.json();
    if (typeof updateFacultyOpenChat === 'function') {
      updateFacultyOpenChat(facultyId, { has_thread: true, thread_id: thread.id, status: thread.status });
    }
    showNotifyModal('Chat started! Waiting for faculty to accept.', 'success');
    skModal.closeAll();
    _switchToMessagesTab();
    await loadChatThreads();
    setTimeout(function () { stuOpenThread(thread.id); }, 300);
  } catch (e) { showNotifyModal(e.message, 'error'); }
}

function _switchToMessagesTab() {
  var btn = document.querySelector('[data-tab="messages"]');
  if (btn) btn.click();
}

// Helpers
function _stuStatusLabel(s) {
  if (s === 'PENDING') return '<span style="color:#b45309">Awaiting</span>';
  if (s === 'ACTIVE') return '<span style="color:var(--sk-success)">Open</span>';
  return '<span style="color:var(--sk-text-placeholder)">Closed</span>';
}

function _stuAgo(d) {
  if (!d) return '';
  var diff = Math.floor((Date.now() - new Date(d)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'd';
}

function _esc(t) { var d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }

// Handle URL param to open specific thread
function _stuCheckUrlParams() {
  var params = new URLSearchParams(window.location.search);
  var threadParam = params.get('thread');
  if (threadParam && params.get('tab') === 'messages') {
    setTimeout(function () { stuOpenThread(parseInt(threadParam)); }, 500);
  }
}

document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') startStudentChatLive();
  else stopStudentChatLive();
});
