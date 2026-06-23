/* dashboard-templates.js — Quick Status Templates (interconnected with Messages) */

async function loadTemplates() {
  try {
    var res = await apiRequest(API_ENDPOINTS.TEMPLATES_LIST);
    var data = await res.json();
    var items = Array.isArray(data) ? data : (data.results || []);
    if (typeof _facultyActiveTab === 'function' && _facultyActiveTab() !== 'templates') return items;
    window._quickTemplates = items;
    var el = document.getElementById('templatesList');
    if (!res.ok) { el.innerHTML = '<div class="sk-empty-state compact sk-ex-068a8ddc"><div class="sk-empty-icon error"><i class="bi bi-exclamation-triangle"></i></div><div class="sk-empty-title">Failed to load templates</div></div>'; return; }
    if (items.length === 0) {
      el.innerHTML = '<div class="sk-ex-068a8ddc">' +
        (window.SKComponents ? SKComponents.emptyState('lightning-fill', 'Save time with Quick Templates', 'Create reusable status messages you can activate with one click.', '<button type="button" onclick="openNewTemplateModal()" class="sk-btn sk-btn-primary">Create Your First Template</button>') :
        '<div class="sk-empty-state compact"><div class="sk-empty-icon"><i class="bi bi-lightning-fill"></i></div><div class="sk-empty-title">Save time with Quick Templates</div><div class="sk-empty-subtitle">Create reusable status messages you can activate with one click.</div><button type="button" onclick="openNewTemplateModal()" class="sk-btn sk-btn-primary">Create Your First Template</button></div>') +
        '</div>';
      return;
    }
    el.innerHTML = items.map(function (t) {
      return '<div class="sk-template-card">' +
        '<div>' +
        '<div class="sk-template-head"><div class="sk-template-icon"><i class="bi ' + escapeHtml(t.icon || 'bi-lightning-fill') + '"></i></div>' +
        '<span class="sk-template-label">' + escapeHtml(t.label) + '</span></div>' +
        '<p class="sk-template-message">' + escapeHtml(t.message) + '</p>' +
        '</div>' +
        '<div class="sk-template-actions">' +
        '<button type="button" onclick="activateTemplate(' + t.id + ')" class="sk-btn sk-action-main sk-action-template"><i class="bi bi-lightning-charge-fill"></i> Go Live</button>' +
        '<button type="button" onclick="openEditTemplateModal(' + t.id + ',\'' + escapeHtml(t.label).replace(/'/g, "\\'") + '\',\'' + escapeHtml(t.message).replace(/'/g, "\\'") + '\',\'' + (t.set_availability || '') + '\')" class="sk-btn sk-action-icon" aria-label="Edit template" title="Edit template"><i class="bi bi-pencil-square"></i></button>' +
        '<button type="button" onclick="deleteTemplate(' + t.id + ')" class="sk-btn sk-action-icon danger" aria-label="Delete template" title="Delete template"><i class="bi bi-trash3"></i></button>' +
        '</div></div>';
    }).join('');
    // Also update the quick-picks in the Add Message modal
    renderTemplateQuickPicks();
  } catch (e) {
    document.getElementById('templatesList').innerHTML = '<div class="sk-empty-state compact sk-ex-068a8ddc"><div class="sk-empty-icon error"><i class="bi bi-exclamation-triangle"></i></div><div class="sk-empty-title">Error loading templates</div></div>';
  }
}

function openNewTemplateModal() {
  document.getElementById('templateModalTitle').textContent = 'New Quick Status';
  document.getElementById('tplId').value = '';
  document.getElementById('tplLabel').value = '';
  document.getElementById('tplMessage').value = '';
  document.getElementById('tplAvail').value = '';
  openModal('addTemplateModal');
}

function openEditTemplateModal(id, label, message, avail) {
  document.getElementById('templateModalTitle').textContent = 'Edit Quick Status';
  document.getElementById('tplId').value = id;
  document.getElementById('tplLabel').value = label;
  document.getElementById('tplMessage').value = message;
  document.getElementById('tplAvail').value = avail;
  openModal('addTemplateModal');
}

async function submitTemplate() {
  var id = document.getElementById('tplId').value;
  var label = document.getElementById('tplLabel').value.trim();
  var message = document.getElementById('tplMessage').value.trim();
  var availChoice = document.getElementById('tplAvail').value;
  if (!label || !message) { await skNotify('Please fill in both fields', { variant: 'info', title: 'Templates' }); return; }
  try {
    var payload = { label: label, message: message, icon: 'bi-lightning-fill' };
    if (availChoice) payload.set_availability = availChoice;
    else payload.set_availability = '';
    
    var url = API_ENDPOINTS.TEMPLATES_LIST;
    var method = 'POST';
    if (id) {
      url += id + '/';
      method = 'PATCH';
    }
    
    var res = await apiRequest(url, { method: method, body: JSON.stringify(payload) });
    if (res.ok) {
      closeModal('addTemplateModal');
      await skNotify(id ? 'Template updated!' : 'Template created! It will now appear as a suggestion when adding statuses.', { variant: 'success', title: 'Templates' });
      loadTemplates();
    } else { var d = await res.json(); await skNotify(JSON.stringify(d), { variant: 'error', title: 'Templates' }); }
  } catch (e) { await skNotify('Failed to save template', { variant: 'error', title: 'Templates' }); }
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
      refreshSidebarInfo();
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
