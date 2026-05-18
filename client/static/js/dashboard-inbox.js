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
        '<button onclick="viewBroadcastPage()" class="text-sm text-blue-500 underline hover:text-blue-700">View your public broadcast page →</button></div>';
      return;
    }
    el.innerHTML = data.map(function (dm) {
      var unread = !dm.is_read;
      var replies = parseReplies(dm.reply_body);
      var avatar = '<div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white" style="background:' + stringToColor(dm.sender_name) + '">' + dm.sender_name.charAt(0).toUpperCase() + '</div>';
      return '<div class="flex gap-3 p-4 rounded-xl border mb-2 transition-shadow hover:shadow-md ' + (unread ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-gray-100') + '">' +
        avatar +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex items-center gap-2"><span class="font-semibold text-sm text-gray-800">' + escapeHtml(dm.sender_name) + '</span>' +
        (unread ? '<span class="w-2 h-2 bg-blue-500 rounded-full"></span>' : '') +
        '<span class="text-xs text-gray-400 ml-auto">' + timeAgo(dm.created_at) + '</span></div>' +
        '<p class="text-xs text-gray-400">' + escapeHtml(dm.sender_email) + (dm.subject ? ' · ' + escapeHtml(dm.subject) : '') + '</p>' +
        '<p class="text-sm text-gray-600 mt-1.5 leading-relaxed">' + escapeHtml(dm.body) + '</p>' +
        renderReplies(replies) +
        '<div class="flex gap-1.5 mt-2">' +
        '<button onclick="openReply(' + dm.id + ',' + JSON.stringify(escapeHtml(dm.sender_name)).replace(/"/g, '&quot;') + ')" class="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition"><i class="bi bi-reply mr-1"></i>' + (replies.length > 0 ? 'Reply Again' : 'Reply') + '</button>' +
        '<button onclick="deleteDm(' + dm.id + ')" class="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 transition"><i class="bi bi-trash"></i></button>' +
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
