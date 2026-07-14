/* dashboard-inbox.js — Direct Messages Inbox (supports multiple replies) */

async function loadUnreadCount() {
  try {
    var res = await apiRequest(API_ENDPOINTS.DM_UNREAD);
    var data = await res.json();
    var badge = document.getElementById('unreadBadge');
    if (data.unread_count > 0) { badge.textContent = data.unread_count; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }
  } catch (e) {}
}

function parseReplies(replyBody) {
  if (!replyBody) return [];
  var parts = replyBody.split('\n---REPLY_SEP---\n');
  return parts.map(function (part) {
    var match = part.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]\s*([\s\S]*)$/);
    if (match) return { timestamp: match[1], text: match[2] };
    return { timestamp: null, text: part };
  });
}

function renderReplies(replies) {
  if (!replies || replies.length === 0) return '';
  return '<div class="mt-2 space-y-1.5">' +
    replies.map(function (r, i) {
      var ts = r.timestamp ? '<span class="text-[10px] text-green-500 ml-1">' + r.timestamp + '</span>' : '';
      return '<div class="bg-green-50 border border-green-200 p-2.5 rounded-lg">' +
        '<p class="text-xs text-green-800"><i class="bi bi-reply-fill mr-1"></i><strong>You replied' + (replies.length > 1 ? ' (' + (i + 1) + ')' : '') + ':</strong> ' + escapeHtml(r.text) + ts + '</p></div>';
    }).join('') + '</div>';
}

async function loadInbox() {
  try {
    var res = await apiRequest(API_ENDPOINTS.DM_INBOX);
    var data = await res.json();
    var el = document.getElementById('inboxList');
    if (!res.ok) { el.innerHTML = '<p class="text-red-500">Failed to load inbox</p>'; return; }
    if (!data || data.length === 0) {
      el.innerHTML = '<div class="text-center py-10">' +
        '<div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><i class="bi bi-envelope-open text-2xl text-blue-500"></i></div>' +
        '<h3 class="text-gray-700 font-semibold mb-1">No messages from visitors yet</h3>' +
        '<p class="text-gray-400 text-sm mb-2">When visitors find you via your <strong>broadcast page</strong> or <strong>QR code</strong>,<br>they can send you private messages that appear here.</p>' +
        '<button type="button" onclick="viewBroadcastPage()" class="text-sm text-blue-500 underline hover:text-blue-700">View your public broadcast page →</button></div>';
      return;
    }
    el.innerHTML = data.map(function (dm) {
      var unread = !dm.is_read;
      var replies = parseReplies(dm.reply_body);
      var avatar = '<div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white ' + SKDynamicStyles.classFor('background:' + stringToColor(dm.sender_name)) + '">' + dm.sender_name.charAt(0).toUpperCase() + '</div>';
      var verifiedBadge = dm.sender_is_registered ? '<i class="bi bi-patch-check-fill text-blue-500 text-xs ml-1" title="Verified Account (ID: ' + escapeHtml(dm.sender_student_id || 'N/A') + ')"></i>' : '';
      var viewProfileBtn = dm.sender_is_registered ? '<button type="button" onclick="event.stopPropagation(); _viewDmSenderProfile(' + JSON.stringify(JSON.stringify({username: dm.sender_name, email: dm.sender_email, student_id: dm.sender_student_id, role: dm.sender_role})).replace(/"/g, '&quot;') + ')" class="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-blue-500 hover:bg-blue-50 transition"><i class="bi bi-person-circle mr-1"></i>View</button>' : '';
      return '<div class="flex gap-3 p-4 rounded-xl border mb-2 transition-shadow hover:shadow-md ' + (unread ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-gray-100') + '">' +
        avatar +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex items-center gap-2"><span class="font-semibold text-sm text-gray-800">' + escapeHtml(dm.sender_name) + '</span>' + verifiedBadge +
        (unread ? '<span class="w-2 h-2 bg-blue-500 rounded-full"></span>' : '') +
        '<span class="text-xs text-gray-400 ml-auto">' + timeAgo(dm.created_at) + '</span></div>' +
        '<p class="text-xs text-gray-400">' + escapeHtml(dm.sender_email) + (dm.subject ? ' · ' + escapeHtml(dm.subject) : '') + '</p>' +
        '<p class="text-sm text-gray-600 mt-1.5 leading-relaxed">' + escapeHtml(dm.body) + '</p>' +
        renderReplies(replies) +
        '<div class="flex gap-1.5 mt-2">' +
        '<button type="button" onclick="openReply(' + dm.id + ',' + JSON.stringify(escapeHtml(dm.sender_name)).replace(/"/g, '&quot;') + ')" class="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition"><i class="bi bi-reply mr-1"></i>' + (replies.length > 0 ? 'Reply Again' : 'Reply') + '</button>' +
        viewProfileBtn +
        '<button type="button" onclick="closeDm(' + dm.id + ')" class="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 transition" title="Close DM"><i class="bi bi-check-circle"></i></button>' +
        '<button type="button" onclick="deleteDm(' + dm.id + ')" class="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 transition" aria-label="Delete direct message" title="Delete direct message"><i class="bi bi-trash"></i></button>' +
        '</div></div></div>';
    }).join('');
    loadUnreadCount();
  } catch (e) { document.getElementById('inboxList').innerHTML = '<p class="text-red-500">Error loading inbox</p>'; }
}

function stringToColor(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  var h = Math.abs(hash % 360);
  return 'hsl(' + h + ', 55%, 55%)';
}

function openReply(id, senderName) {
  document.getElementById('replyDmId').value = id;
  document.getElementById('replyTo').textContent = senderName;
  document.getElementById('replyBody').value = '';
  openModal('replyModal');
}

async function submitReply() {
  var id = document.getElementById('replyDmId').value;
  var body = document.getElementById('replyBody').value.trim();
  if (!body) { await skNotify('Please write a reply', { variant: 'info', title: 'Inbox' }); return; }
  try {
    var res = await apiRequest(API_BASE_URL + '/api/messaging/' + id + '/reply/', {
      method: 'POST', body: JSON.stringify({ reply_body: body })
    });
    if (res.ok) {
      closeModal('replyModal');
      await skNotify('Reply sent! The visitor will receive it via email.', { variant: 'success', title: 'Inbox' });
      loadInbox();
    } else { await skNotify('Failed to send reply', { variant: 'error', title: 'Inbox' }); }
  } catch (e) { await skNotify('Error sending reply', { variant: 'error', title: 'Inbox' }); }
}

async function deleteDm(id) {
  var ok = await skConfirm('Delete this message?', { title: 'Delete', confirmText: 'Delete', danger: true });
  if (!ok) return;
  try {
    var res = await apiRequest(API_BASE_URL + '/api/messaging/' + id + '/delete/', { method: 'DELETE' });
    if (res.ok) { await skNotify('Deleted!', { variant: 'success', title: 'Inbox' }); loadInbox(); loadUnreadCount(); }
  } catch (e) { await skNotify('Failed to delete', { variant: 'error', title: 'Inbox' }); }
}

async function closeDm(id) {
  var ok = await skConfirm('Mark this message as closed?', { title: 'Close DM', confirmText: 'Close' });
  if (!ok) return;
  try {
    var res = await apiRequest(API_BASE_URL + '/api/messaging/' + id + '/close-dm/', { method: 'POST' });
    if (res.ok) { await skNotify('DM closed.', { variant: 'success', title: 'Inbox' }); loadInbox(); loadUnreadCount(); }
    else { await skNotify('Failed to close DM.', { variant: 'error', title: 'Inbox' }); }
  } catch (e) { await skNotify('Error closing DM.', { variant: 'error', title: 'Inbox' }); }
}

function _viewDmSenderProfile(jsonStr) {
  var info = JSON.parse(jsonStr);
  var verifiedBadge = info.student_id ? '<span class="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-semibold border border-blue-200 mt-2"><i class="bi bi-patch-check-fill"></i>Verified Student</span>' : '';
  var content =
    '<div class="text-center">' +
      '<div class="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl mx-auto">' + (info.username || 'U').charAt(0).toUpperCase() + '</div>' +
      '<h3 class="font-bold text-gray-800 text-lg mt-3">' + escapeHtml(info.username || 'User') + '</h3>' +
      (info.email ? '<p class="text-sm text-gray-500 mt-1"><i class="bi bi-envelope mr-1"></i>' + escapeHtml(info.email) + '</p>' : '') +
      (info.student_id ? '<p class="text-sm text-gray-500 mt-1"><i class="bi bi-person-badge mr-1"></i>ID: ' + escapeHtml(info.student_id) + '</p>' : '') +
      (info.role ? '<p class="text-xs text-gray-400 mt-1">Role: ' + escapeHtml(info.role) + '</p>' : '') +
      verifiedBadge +
    '</div>';
  skModal.open(content, { title: 'Sender Profile', maxWidth: 'max-w-sm' });
}
