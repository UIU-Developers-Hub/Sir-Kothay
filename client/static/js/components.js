/* ============================================================
   SIR KOTHAY — Shared UI Components (JS)
   Renders reusable HTML component strings
   ============================================================ */

window.SKComponents = (() => {
  'use strict';

  const esc = (t) => SKUtils.escapeHtml(t);

  /* ─────────────────────────────────────────────────────────
     AVATAR
     ───────────────────────────────────────────────────────── */
  function avatar(src, name, size = 'md', extraClass = '') {
    const initials = SKUtils.getInitials(name);
    const sizeClass = `sk-avatar-${size}`;
    if (src) {
      return `<div class="sk-avatar ${sizeClass} ${extraClass}">
        <img src="${esc(src)}" alt="${esc(name)}" onerror="this.parentElement.innerHTML='${initials}'">
      </div>`;
    }
    const bg = SKUtils.stringToColor(name);
    return `<div class="sk-avatar ${sizeClass} ${extraClass}" style="background:${bg};color:white">${initials}</div>`;
  }

  function avatarWithStatus(src, name, status, size = 'md') {
    const statusClass = status ? 'online' : 'offline';
    return `<div class="sk-avatar-wrapper">
      ${avatar(src, name, size)}
      <div class="sk-avatar-status ${statusClass}"></div>
    </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     BADGE
     ───────────────────────────────────────────────────────── */
  function badge(text, variant = 'neutral', icon = '') {
    const iconHtml = icon ? `<i class="bi bi-${icon}"></i> ` : '';
    return `<span class="sk-badge sk-badge-${variant}">${iconHtml}${esc(text)}</span>`;
  }

  /* ─────────────────────────────────────────────────────────
     STAT CARD
     ───────────────────────────────────────────────────────── */
  function statCard(icon, label, value, color = 'orange') {
    return `<div class="sk-stat-card sk-fade-up">
      <div class="sk-stat-icon ${color}">
        <i class="bi bi-${icon}"></i>
      </div>
      <div>
        <div class="sk-stat-value">${esc(String(value))}</div>
        <div class="sk-stat-label">${esc(label)}</div>
      </div>
    </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     EMPTY STATE
     ───────────────────────────────────────────────────────── */
  function emptyState(icon, title, subtitle, btnHtml = '') {
    return `<div class="sk-empty-state">
      <div class="sk-empty-icon"><i class="bi bi-${icon}"></i></div>
      <div class="sk-empty-title">${esc(title)}</div>
      <div class="sk-empty-subtitle">${esc(subtitle)}</div>
      ${btnHtml}
    </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     SKELETON LOADERS
     ───────────────────────────────────────────────────────── */
  function skeletonCard(count = 1) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `<div class="sk-card" style="padding:1.25rem">
        <div class="sk-skeleton-row">
          <div class="sk-skeleton sk-skeleton-avatar"></div>
          <div style="flex:1">
            <div class="sk-skeleton sk-skeleton-text w-2/3"></div>
            <div class="sk-skeleton sk-skeleton-text w-1/3"></div>
          </div>
        </div>
        <div class="sk-skeleton sk-skeleton-text" style="margin-top:0.75rem"></div>
        <div class="sk-skeleton sk-skeleton-text w-3/4"></div>
      </div>`;
    }
    return html;
  }

  function skeletonList(rows = 5) {
    let html = '';
    for (let i = 0; i < rows; i++) {
      html += `<div class="sk-skeleton-row">
        <div class="sk-skeleton sk-skeleton-avatar"></div>
        <div style="flex:1">
          <div class="sk-skeleton sk-skeleton-text w-2/3"></div>
          <div class="sk-skeleton sk-skeleton-text w-1/2"></div>
        </div>
      </div>`;
    }
    return html;
  }

  function skeletonStats(count = 4) {
    let html = '<div class="sk-grid sk-grid-4" style="margin-bottom:1.5rem">';
    for (let i = 0; i < count; i++) {
      html += `<div class="sk-stat-card">
        <div class="sk-skeleton sk-skeleton-avatar"></div>
        <div style="flex:1">
          <div class="sk-skeleton sk-skeleton-text w-1/3" style="height:1.5rem;margin-bottom:0.5rem"></div>
          <div class="sk-skeleton sk-skeleton-text w-2/3"></div>
        </div>
      </div>`;
    }
    html += '</div>';
    return html;
  }

  function skeletonTable(rows = 5, cols = 5) {
    let html = '<div class="sk-table-wrap"><table class="sk-table"><thead><tr>';
    for (let c = 0; c < cols; c++) {
      html += '<th><div class="sk-skeleton sk-skeleton-text" style="width:80px;margin:0"></div></th>';
    }
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const w = c === 0 ? '60%' : c === 1 ? '80%' : '50%';
        html += `<td><div class="sk-skeleton sk-skeleton-text" style="width:${w};margin:0"></div></td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function skeletonChat() {
    return `<div style="padding:1rem;display:flex;flex-direction:column;gap:1rem">
      <div style="display:flex;gap:0.5rem;align-items:flex-end">
        <div class="sk-skeleton sk-skeleton-avatar sk-avatar-sm"></div>
        <div class="sk-skeleton" style="width:60%;height:48px;border-radius:1rem"></div>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:flex-end;justify-content:flex-end">
        <div class="sk-skeleton" style="width:45%;height:40px;border-radius:1rem"></div>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:flex-end">
        <div class="sk-skeleton sk-skeleton-avatar sk-avatar-sm"></div>
        <div class="sk-skeleton" style="width:70%;height:56px;border-radius:1rem"></div>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:flex-end;justify-content:flex-end">
        <div class="sk-skeleton" style="width:35%;height:36px;border-radius:1rem"></div>
      </div>
    </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     CHAT BUBBLE
     ───────────────────────────────────────────────────────── */
  function chatBubble(body, isMe, time, senderName = '') {
    const dir = isMe ? 'sent' : 'received';
    const nameHtml = (!isMe && senderName) 
      ? `<div style="font-size:0.6875rem;font-weight:600;color:var(--sk-primary);margin-bottom:2px">${esc(senderName)}</div>` 
      : '';
    return `<div class="sk-chat-bubble ${dir}">
      ${nameHtml}
      <div>${esc(body)}</div>
      <div class="sk-chat-time">${esc(time)}</div>
    </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     MODAL WRAPPER
     ───────────────────────────────────────────────────────── */
  function modal(id, title, bodyHtml, footerHtml = '', maxWidth = '480px') {
    return `<div id="${id}" class="sk-modal-overlay" style="display:none" onclick="if(event.target===this)SKComponents.closeModal('${id}')">
      <div class="sk-modal-panel" style="max-width:${maxWidth}">
        <div class="sk-modal-header">
          <h3 class="sk-modal-title">${esc(title)}</h3>
          <button class="sk-modal-close" onclick="SKComponents.closeModal('${id}')" aria-label="Close">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="sk-modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="sk-modal-footer">${footerHtml}</div>` : ''}
      </div>
    </div>`;
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  /* ─────────────────────────────────────────────────────────
     TOAST
     ───────────────────────────────────────────────────────── */
  let _toastContainer = null;

  function toast(message, variant = 'info', duration = 4000) {
    if (!_toastContainer) {
      _toastContainer = document.createElement('div');
      _toastContainer.className = 'sk-toast-container';
      document.body.appendChild(_toastContainer);
    }

    const icons = {
      success: 'check-circle-fill',
      error: 'exclamation-circle-fill',
      warning: 'exclamation-triangle-fill',
      info: 'info-circle-fill'
    };

    const toastEl = document.createElement('div');
    toastEl.className = `sk-toast ${variant}`;
    toastEl.innerHTML = `
      <i class="bi bi-${icons[variant] || icons.info} sk-toast-icon"></i>
      <span class="sk-toast-text">${esc(message)}</span>
      <button class="sk-toast-dismiss" onclick="this.parentElement.remove()">
        <i class="bi bi-x"></i>
      </button>
    `;

    _toastContainer.appendChild(toastEl);

    if (duration > 0) {
      setTimeout(() => {
        toastEl.style.opacity = '0';
        toastEl.style.transform = 'translateX(100%)';
        toastEl.style.transition = 'all 300ms ease';
        setTimeout(() => toastEl.remove(), 300);
      }, duration);
    }
  }

  /* ─────────────────────────────────────────────────────────
     CONFIRM DIALOG
     ───────────────────────────────────────────────────────── */
  function confirm(message, options = {}) {
    return new Promise((resolve) => {
      const id = SKUtils.uid('confirm');
      const title = options.title || 'Confirm';
      const confirmText = options.confirmText || 'Confirm';
      const cancelText = options.cancelText || 'Cancel';
      const danger = options.danger ? 'sk-btn-danger' : 'sk-btn-primary';

      const overlay = document.createElement('div');
      overlay.className = 'sk-modal-overlay';
      overlay.style.display = 'flex';
      overlay.innerHTML = `
        <div class="sk-modal-panel" style="max-width:400px">
          <div class="sk-modal-header">
            <h3 class="sk-modal-title">${esc(title)}</h3>
          </div>
          <div class="sk-modal-body">
            <p style="color:var(--sk-text-secondary);font-size:var(--sk-text-sm)">${esc(message)}</p>
          </div>
          <div class="sk-modal-footer">
            <button class="sk-btn sk-btn-secondary" id="${id}-cancel">${esc(cancelText)}</button>
            <button class="sk-btn ${danger}" id="${id}-confirm">${esc(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';

      const cleanup = (result) => {
        overlay.remove();
        document.body.style.overflow = '';
        resolve(result);
      };

      overlay.querySelector(`#${id}-cancel`).addEventListener('click', () => cleanup(false));
      overlay.querySelector(`#${id}-confirm`).addEventListener('click', () => cleanup(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
      document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onEsc); cleanup(false); }
      });
    });
  }

  /* ─────────────────────────────────────────────────────────
     TAB BAR
     ───────────────────────────────────────────────────────── */
  function tabBar(tabs, activeTab, onSwitchFn) {
    return `<div class="sk-tabs">${tabs.map(t => {
      const isActive = t.id === activeTab ? 'active' : '';
      const iconHtml = t.icon ? `<i class="bi bi-${t.icon}"></i>` : '';
      const badgeHtml = t.badge ? `<span class="sk-sidebar-badge">${t.badge}</span>` : '';
      return `<button class="sk-tab ${isActive}" data-tab="${t.id}" onclick="${onSwitchFn}('${t.id}')">
        ${iconHtml} ${esc(t.label)} ${badgeHtml}
      </button>`;
    }).join('')}</div>`;
  }

  /* ─────────────────────────────────────────────────────────
     TOGGLE SWITCH
     ───────────────────────────────────────────────────────── */
  function toggleSwitch(id, label, checked, onChangeFn) {
    const chk = checked ? 'checked' : '';
    return `<label class="sk-toggle">
      <input type="checkbox" id="${id}" ${chk} onchange="${onChangeFn}">
      <div class="sk-toggle-track"><div class="sk-toggle-thumb"></div></div>
      <span class="sk-toggle-label">${esc(label)}</span>
    </label>`;
  }

  /* ─────────────────────────────────────────────────────────
     SEARCH BAR
     ───────────────────────────────────────────────────────── */
  function searchBar(placeholder, onInputFn, id = 'search') {
    return `<div class="sk-search">
      <i class="bi bi-search sk-search-icon"></i>
      <input type="text" class="sk-input" id="${id}" placeholder="${esc(placeholder)}" oninput="${onInputFn}">
    </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     PAGE HEADER
     ───────────────────────────────────────────────────────── */
  function pageHeader(title, subtitle, actionsHtml = '') {
    return `<div class="sk-page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div>
        <h1 class="sk-page-title">${esc(title)}</h1>
        ${subtitle ? `<p class="sk-page-subtitle">${esc(subtitle)}</p>` : ''}
      </div>
      ${actionsHtml ? `<div style="display:flex;gap:0.5rem;flex-wrap:wrap">${actionsHtml}</div>` : ''}
    </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     AVAILABILITY BADGE
     ───────────────────────────────────────────────────────── */
  function availabilityBadge(isAvailable, size = 'default') {
    if (isAvailable) {
      return `<span class="sk-badge sk-badge-success">
        <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block" class="sk-pulse-dot"></span>
        Available
      </span>`;
    }
    return `<span class="sk-badge sk-badge-neutral">
      <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block"></span>
      Unavailable
    </span>`;
  }

  return {
    avatar,
    avatarWithStatus,
    badge,
    statCard,
    emptyState,
    skeletonCard,
    skeletonList,
    skeletonStats,
    skeletonTable,
    skeletonChat,
    chatBubble,
    modal,
    openModal,
    closeModal,
    toast,
    confirm,
    tabBar,
    toggleSwitch,
    searchBar,
    pageHeader,
    availabilityBadge
  };
})();
