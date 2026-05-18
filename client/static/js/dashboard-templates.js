/* dashboard-templates.js — Quick Status Templates (interconnected with Messages) */

async function loadTemplates() {
  try {
    var res = await apiRequest(API_ENDPOINTS.TEMPLATES_LIST);
    var data = await res.json();
    window._quickTemplates = Array.isArray(data) ? data : (data.results || []);
    var el = document.getElementById('templatesList');
    if (!res.ok) { el.innerHTML = '<p class="text-red-500">Failed to load templates</p>'; return; }
    var items = window._quickTemplates;
    if (items.length === 0) {
      el.innerHTML = '<div class="col-span-full text-center py-10">' +
        '<div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4"><i class="bi bi-lightning-fill text-2xl text-purple-500"></i></div>' +
        '<h3 class="text-gray-700 font-semibold mb-1">Save time with Quick Templates</h3>' +
        '<p class="text-gray-400 text-sm mb-2">Create reusable status messages you can activate with one click.<br>They also appear as suggestions when adding new broadcast statuses.</p>' +
        '<button onclick="openModal(\'addTemplateModal\')" class="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-purple-700 transition">Create Your First Template</button></div>';
      return;
    }
    el.innerHTML = items.map(function (t) {
      return '<div class="border border-gray-100 rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer bg-white flex flex-col justify-between group">' +
        '<div>' +
        '<div class="flex items-center gap-2 mb-2"><div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center"><i class="bi ' + escapeHtml(t.icon || 'bi-lightning-fill') + ' text-orange-500"></i></div>' +
        '<span class="font-semibold text-sm text-gray-800">' + escapeHtml(t.label) + '</span></div>' +
        '<p class="text-xs text-gray-500 leading-relaxed mb-3">' + escapeHtml(t.message) + '</p>' +
        '</div>' +
        '<div class="flex gap-1.5">' +
        '<button onclick="activateTemplate(' + t.id + ')" class="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs px-2 py-2 rounded-lg hover:from-orange-600 hover:to-orange-700 transition shadow-sm"><i class="bi bi-broadcast mr-1"></i>Go Live</button>' +
        '<button onclick="deleteTemplate(' + t.id + ')" class="text-gray-300 hover:text-red-500 px-2 transition opacity-0 group-hover:opacity-100"><i class="bi bi-trash"></i></button>' +
        '</div></div>';
    }).join('');
    // Also update the quick-picks in the Add Message modal
    renderTemplateQuickPicks();
  } catch (e) {
    document.getElementById('templatesList').innerHTML = '<p class="text-red-500 col-span-3">Error loading templates</p>';
  }
}

async function submitTemplate() {
  var label = document.getElementById('tplLabel').value.trim();
  var message = document.getElementById('tplMessage').value.trim();
  var availChoice = document.getElementById('tplAvail').value;
  if (!label || !message) { await skNotify('Please fill in both fields', { variant: 'info', title: 'Templates' }); return; }
  try {
    var payload = { label: label, message: message, icon: 'bi-lightning-fill' };
    if (availChoice) payload.set_availability = availChoice;
    var res = await apiRequest(API_ENDPOINTS.TEMPLATES_LIST, {
      method: 'POST', body: JSON.stringify(payload)
    });
    if (res.ok) {
      document.getElementById('tplLabel').value = ''; document.getElementById('tplMessage').value = ''; document.getElementById('tplAvail').value = '';
      closeModal('addTemplateModal');
      await skNotify('Template created! It will now appear as a suggestion when adding statuses.', { variant: 'success', title: 'Templates' });
      loadTemplates();
    } else { var d = await res.json(); await skNotify(JSON.stringify(d), { variant: 'error', title: 'Templates' }); }
  } catch (e) { await skNotify('Failed to create template', { variant: 'error', title: 'Templates' }); }
}

async function activateTemplate(id) {
  try {
    var res = await apiRequest(API_ENDPOINTS.TEMPLATES_LIST + id + '/activate/', { method: 'POST' });
    var d = await res.json();
    if (res.ok) {
      // Check if this template has an availability preference stored
      var tpl = window._quickTemplates.find(function(t) { return t.id === id; });
      if (tpl && tpl.set_availability) {
        await setAvailability(tpl.set_availability === 'true');
      }
      await skNotify(d.message || 'Status is now live!', { variant: 'success', title: 'Broadcast' });
      // Switch to Messages tab to show the newly active status
      document.querySelector('[data-tab=messages]').click();
    } else { await skNotify('Failed to activate', { variant: 'error', title: 'Templates' }); }
  } catch (e) { await skNotify('Error activating template', { variant: 'error', title: 'Templates' }); }
}

async function deleteTemplate(id) {
  var ok = await skConfirm('Delete this template?', { title: 'Delete Template', confirmText: 'Delete', danger: true });
  if (!ok) return;
  try {
    var res = await apiRequest(API_ENDPOINTS.TEMPLATES_LIST + id + '/', { method: 'DELETE' });
    if (res.ok) { await skNotify('Deleted!', { variant: 'success', title: 'Templates' }); loadTemplates(); }
  } catch (e) { await skNotify('Failed to delete', { variant: 'error', title: 'Templates' }); }
}
