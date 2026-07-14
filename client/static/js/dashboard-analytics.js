/* dashboard-analytics.js — Page view analytics + subscriber count (interconnected overview) */

async function loadAnalytics() {
  // Page views
  try {
    var res = await apiRequest(API_ENDPOINTS.ANALYTICS);
    var data = await res.json();
    document.getElementById('totalViews').textContent = data.total_views || 0;
    document.getElementById('totalScans').textContent = data.total_qr_scans || 0;
    drawChart(data.daily || []);
  } catch (e) {
    document.getElementById('totalViews').textContent = '—';
    document.getElementById('totalScans').textContent = '—';
  }

  // Subscriber count
  try {
    var sRes = await apiRequest(API_ENDPOINTS.SUBSCRIBERS);
    var sData = await sRes.json();
    var subs = Array.isArray(sData) ? sData : (sData.results || []);
    document.getElementById('subscriberCount').textContent = subs.length;
    renderSubscriberList(subs);
  } catch (e) { document.getElementById('subscriberCount').textContent = '—'; }

  // Unread DM count
  try {
    var dmRes = await apiRequest(API_ENDPOINTS.DM_UNREAD);
    var dmData = await dmRes.json();
    document.getElementById('unreadDmCount').textContent = dmData.unread_count || 0;
  } catch (e) { document.getElementById('unreadDmCount').textContent = '—'; }
}

function renderSubscriberList(subs) {
  var el = document.getElementById('subscriberListSection');
  if (!el) return;
  if (subs.length === 0) {
    el.innerHTML = '<p class="text-xs text-gray-400 italic">No subscribers yet. Visitors can subscribe on your broadcast page to get notified when you\'re available.</p>';
    return;
  }
  el.innerHTML = '<p class="text-xs text-gray-500 mb-2">Email subscribers — they get notified when your status contains "available":</p>' +
    subs.map(function (s) {
      return '<div class="flex items-center justify-between text-xs py-1.5 border-b border-gray-50">' +
        '<span class="text-gray-600"><i class="bi bi-envelope text-gray-400 mr-1"></i>' + escapeHtml(s.email) + '</span>' +
        '<div class="flex items-center gap-2">' +
        '<span class="text-gray-400">' + (s.is_active ? '<span class="text-green-500">Active</span>' : '<span class="text-gray-400">Inactive</span>') + '</span>' +
        '<button type="button" onclick="removeSubscriber(' + s.id + ')" class="text-gray-300 hover:text-red-500" aria-label="Remove subscriber" title="Remove subscriber"><i class="bi bi-x-lg"></i></button></div></div>';
    }).join('');
}

async function removeSubscriber(id) {
  try {
    var res = await apiRequest(API_ENDPOINTS.SUBSCRIBERS + id + '/', { method: 'DELETE' });
    if (res.ok) { loadAnalytics(); }
  } catch (e) {}
}

function drawChart(daily) {
  var canvas = document.getElementById('analyticsChart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = 180;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  var days = [];
  var today = new Date();
  for (var i = 29; i >= 0; i--) {
    var d = new Date(today); d.setDate(d.getDate() - i);
    var key = d.toISOString().slice(0, 10);
    var found = daily.find(function (r) { return r.date === key; });
    days.push({ date: key, views: found ? found.view_count : 0, scans: found ? found.qr_scan_count : 0 });
  }

  var maxVal = Math.max(1, Math.max.apply(null, days.map(function (d) { return d.views + d.scans; })));
  var padL = 36, padR = 8, padT = 20, padB = 25;
  var chartW = canvas.width - padL - padR;
  var chartH = canvas.height - padT - padB;
  var barW = Math.max(4, (chartW / days.length) - 3);

  // Grid lines
  ctx.strokeStyle = '#f3f4f6'; ctx.lineWidth = 1;
  for (var yi = 0; yi <= 4; yi++) {
    var yy = padT + (chartH - (chartH * yi / 4));
    ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(canvas.width - padR, yy); ctx.stroke();
    ctx.fillStyle = '#9ca3af'; ctx.font = '10px Poppins, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * yi / 4), padL - 4, yy + 3);
  }

  // Bars
  for (var bi = 0; bi < days.length; bi++) {
    var x = padL + bi * (chartW / days.length) + 1;
    var viewH = (days[bi].views / maxVal) * chartH;
    var scanH = (days[bi].scans / maxVal) * chartH;
    var radius = Math.min(barW / 2 - 1, 3);

    // Views bar (blue)
    ctx.fillStyle = '#3b82f6';
    roundedRect(ctx, x, padT + chartH - viewH, barW / 2 - 1, viewH, radius);
    // Scans bar (green)
    ctx.fillStyle = '#22c55e';
    roundedRect(ctx, x + barW / 2, padT + chartH - scanH, barW / 2 - 1, scanH, radius);

    if (bi % 5 === 0) {
      ctx.fillStyle = '#9ca3af'; ctx.font = '9px Poppins, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(days[bi].date.slice(5), x + barW / 2, canvas.height - 5);
    }
  }

  // Legend
  ctx.fillStyle = '#3b82f6'; roundedRect(ctx, padL, 4, 10, 10, 2);
  ctx.fillStyle = '#374151'; ctx.font = '10px Poppins, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Page Views', padL + 14, 13);
  ctx.fillStyle = '#22c55e'; roundedRect(ctx, padL + 85, 4, 10, 10, 2);
  ctx.fillStyle = '#374151'; ctx.fillText('QR Scans', padL + 99, 13);
}

function roundedRect(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.fill();
}
