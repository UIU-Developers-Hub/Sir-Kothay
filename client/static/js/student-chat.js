/* student-chat.js — Split-panel chat UI for student dashboard */
var _stuThreads = [];
var _stuActiveThread = null;

async function loadChatThreads() {
  try {
    var res = await fetch(API_BASE_URL + '/api/messaging/chat/threads/', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
    });
    if (!res.ok) throw new Error('Failed');
    _stuThreads = await res.json();
    _stuRenderList();
  } catch (e) {
    document.getElementById('stuConvoList').innerHTML = '<p class="text-red-500 text-center py-8 text-xs">Failed to load.</p>';
  }
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
    el.innerHTML = '<div class="py-16 text-center"><i class="bi bi-chat-square text-3xl text-gray-200 mb-2 block"></i><p class="text-xs text-gray-400">No conversations yet</p><p class="text-[10px] text-gray-300 mt-1">Start one from a faculty card</p></div>';
    return;
  }

  el.innerHTML = sorted.map(function (t) {
    var fac = t.faculty_info || {};
    var isActive = _stuActiveThread && _stuActiveThread.id === t.id;
    var initial = (fac.username || 'F').charAt(0).toUpperCase();
    var badge = '';
    if (t.status === 'PENDING') badge = '<span class="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0"></span>';
    else if (t.status === 'ACTIVE') badge = '<span class="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></span>';
    else badge = '<span class="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0"></span>';
    var lastMsg = t.last_message ? t.last_message.body : '';
    return '<div class="flex gap-2.5 px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-blue-50/50 transition-colors ' + (isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : '') + '" onclick="stuOpenThread(' + t.id + ')">' +
      '<div class="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">' + initial + '</div>' +
      '<div class="flex-1 min-w-0">' +
        '<div class="flex items-center gap-1.5">' +
          '<span class="text-xs font-semibold text-gray-800 truncate">' + _esc(fac.username || 'Faculty') + '</span>' +
          badge +
          '<span class="text-[10px] text-gray-400 ml-auto flex-shrink-0">' + _stuAgo(t.last_activity_at) + '</span>' +
        '</div>' +
        '<p class="text-[11px] text-gray-500 truncate font-medium">' + _esc(t.subject) + '</p>' +
        '<p class="text-[10px] text-gray-400 truncate">' + _esc(lastMsg) + '</p>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function stuOpenThread(threadId) {
  // Show detail panel, hide empty state
  document.getElementById('stuChatListPanel').classList.add('hidden', 'md:flex');
  document.getElementById('stuChatDetailPanel').classList.remove('hidden');
  document.getElementById('stuChatDetailPanel').classList.add('flex');
  document.getElementById('stuChatEmpty').classList.add('hidden');
  document.getElementById('stuChatActive').classList.remove('hidden');

  try {
    var res = await fetch(API_BASE_URL + '/api/messaging/chat/' + threadId + '/', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
    });
    if (!res.ok) throw new Error('Failed');
    var thread = await res.json();
    _stuActiveThread = thread;
    _stuRenderList(); // highlight
    _stuRenderDetail(thread);
  } catch (e) {
    showNotifyModal('Failed to open conversation.', 'error');
  }
}

function _stuRenderDetail(thread) {
  var fac = thread.faculty_info || {};
  var messages = thread.messages || [];

  // Header
  var headerHtml =
    '<button onclick="_stuBackToList()" class="md:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 mr-1"><i class="bi bi-arrow-left"></i></button>' +
    '<div class="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">' + (fac.username || 'F').charAt(0).toUpperCase() + '</div>' +
    '<div class="flex-1 min-w-0">' +
      '<p class="text-sm font-bold text-gray-800 truncate">' + _esc(fac.username || 'Faculty') + '</p>' +
      '<p class="text-[10px] text-gray-400 truncate">' + _esc(thread.subject) + ' · ' + _stuStatusLabel(thread.status) + '</p>' +
    '</div>' +
    '<div class="flex items-center gap-2 flex-shrink-0">' +
      (fac.slug ? '<a href="../broadcast/message.html?user=' + fac.slug + '" target="_blank" class="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-orange-500 hover:bg-orange-50"><i class="bi bi-box-arrow-up-right mr-0.5"></i>Profile</a>' : '') +
      (thread.status !== 'CLOSED' ? '<button onclick="_stuCloseThread(' + thread.id + ')" class="text-[10px] px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50" title="Close"><i class="bi bi-x-circle"></i></button>' : '') +
      '<button onclick="_stuDeleteThread(' + thread.id + ')" class="text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Delete"><i class="bi bi-trash"></i></button>' +
    '</div>';
  document.getElementById('stuChatHeader').innerHTML = headerHtml;

  // Messages
  var msgsHtml = '';
  if (thread.status === 'PENDING') {
    msgsHtml += '<div class="bg-yellow-50 text-yellow-700 text-xs font-medium px-4 py-2 rounded-xl border border-yellow-200 mb-3 text-center"><i class="bi bi-hourglass-split mr-1"></i>Waiting for faculty to accept this chat.</div>';
  }
  msgsHtml += messages.map(function (m) {
    var isMe = m.sender === (currentUser ? currentUser.id : null);
    var align = isMe ? 'items-end' : 'items-start';
    var bg = isMe ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800';
    return '<div class="flex flex-col ' + align + ' mb-2.5">' +
      '<div class="' + bg + ' px-4 py-2.5 rounded-2xl max-w-[80%] shadow-sm">' +
        '<p class="text-sm leading-relaxed">' + _esc(m.body) + '</p>' +
      '</div>' +
      '<span class="text-[10px] text-gray-400 mt-0.5 px-1">' + _esc(m.sender_name) + ' · ' + _stuAgo(m.created_at) + '</span>' +
    '</div>';
  }).join('');
  if (!messages.length && thread.status !== 'PENDING') msgsHtml += '<p class="text-center text-gray-300 text-xs py-8">No messages yet.</p>';
  if (thread.status === 'CLOSED') {
    var closedBy = thread.closed_by_name || 'System (inactivity)';
    msgsHtml += '<div class="bg-gray-50 text-gray-400 text-xs font-medium px-4 py-2 rounded-xl border border-gray-200 mt-3 text-center"><i class="bi bi-lock mr-1"></i>Closed by ' + _esc(closedBy) + '</div>';
  }
  document.getElementById('stuChatMessages').innerHTML = msgsHtml;

  // Reply bar
  var canReply = thread.status !== 'CLOSED';
  if (canReply) {
    document.getElementById('stuChatReplyBar').innerHTML =
      '<div class="flex gap-2">' +
        '<input type="text" id="stuReplyInput" placeholder="Type a message..." class="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" onkeydown="if(event.key===\'Enter\')_stuSendReply(' + thread.id + ')">' +
        '<button onclick="_stuSendReply(' + thread.id + ')" class="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-600 transition shadow-sm"><i class="bi bi-send"></i></button>' +
      '</div>';
  } else {
    document.getElementById('stuChatReplyBar').innerHTML = '<p class="text-xs text-gray-400 text-center">This conversation is closed.</p>';
  }

  // Scroll to bottom
  setTimeout(function () {
    var el = document.getElementById('stuChatMessages');
    if (el) el.scrollTop = el.scrollHeight;
  }, 80);
}

async function _stuSendReply(threadId) {
  var input = document.getElementById('stuReplyInput');
  if (!input || !input.value.trim()) return;
  var body = input.value.trim();
  input.disabled = true;
  try {
    var res = await fetch(API_BASE_URL + '/api/messaging/chat/' + threadId + '/reply/', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token'), 'Content-Type': 'application/json' },
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
      method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
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
      method: 'DELETE', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
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
      method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
    });
    if (!res.ok) throw new Error('Failed');
    var data = await res.json();
    showNotifyModal(data.message || 'All threads deleted.', 'success');
    _stuActiveThread = null; await loadChatThreads(); _stuBackToList();
  } catch (e) { showNotifyModal('Failed.', 'error'); }
}

function _stuBackToList() {
  document.getElementById('stuChatListPanel').classList.remove('hidden', 'md:flex');
  document.getElementById('stuChatListPanel').classList.add('flex');
  document.getElementById('stuChatDetailPanel').classList.add('hidden');
  document.getElementById('stuChatDetailPanel').classList.remove('flex');
  document.getElementById('stuChatEmpty').classList.remove('hidden');
  document.getElementById('stuChatActive').classList.add('hidden');
  if (window.innerWidth >= 768) {
    document.getElementById('stuChatDetailPanel').classList.remove('hidden');
    document.getElementById('stuChatDetailPanel').classList.add('flex');
  }
}

// Called from student-dashboard.js faculty cards
async function initiateNewChat(facultyId, facultySlug, facultyName) {
  // Check for existing thread first
  try {
    var checkRes = await fetch(API_BASE_URL + '/api/messaging/chat/check/' + facultyId + '/', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
    });
    var checkData = await checkRes.json();
    if (checkData.has_thread) {
      _switchToMessagesTab();
      setTimeout(function () { stuOpenThread(checkData.thread_id); }, 300);
      return;
    }
  } catch (e) {}

  // Show initiation form in a modal
  var formHtml =
    '<p class="text-sm text-gray-600 mb-4">Start a conversation with <strong>' + _esc(facultyName) + '</strong>.</p>' +
    '<input type="text" id="chatSubjectInput" placeholder="Subject (e.g. Office hours query)" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400">' +
    '<textarea id="chatBodyInput" placeholder="Your message..." class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400" rows="3"></textarea>' +
    '<button onclick="_submitNewChat(' + facultyId + ')" class="w-full bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors shadow-md shadow-blue-500/20"><i class="bi bi-send mr-1"></i>Send</button>';
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
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ faculty_id: facultyId, subject: subject, body: body })
    });
    if (!res.ok) {
      var err = await res.json();
      if (err.thread_id) { skModal.closeAll(); _switchToMessagesTab(); setTimeout(function () { stuOpenThread(err.thread_id); }, 300); return; }
      throw new Error(err.error || 'Failed');
    }
    var thread = await res.json();
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
  if (s === 'PENDING') return '<span class="text-yellow-600">Awaiting</span>';
  if (s === 'ACTIVE') return '<span class="text-green-600">Open</span>';
  return '<span class="text-gray-400">Closed</span>';
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
