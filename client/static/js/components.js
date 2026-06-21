/* ============================================================
   SIR KOTHAY — Shared UI Components (JS)
   Renders reusable HTML component strings
   ============================================================ */

window.SKDynamicStyles = window.SKDynamicStyles || (() => {
  'use strict';

  const cache = new Map();
  let sheetEl = null;

  function getSheet() {
    if (!sheetEl) {
      sheetEl = document.createElement('style');
      sheetEl.setAttribute('data-sk-dynamic-styles', '');
      document.head.appendChild(sheetEl);
    }
    return sheetEl.sheet;
  }

  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function normalize(styleText) {
    return String(styleText || '').trim().replace(/\s+/g, ' ').replace(/;\s*$/, '');
  }

  function classFor(styleText) {
    const style = normalize(styleText);
    if (!style) return '';
    if (cache.has(style)) return cache.get(style);
    const className = 'sk-dyn-' + hash(style);
    cache.set(style, className);
    try {
      getSheet().insertRule('.' + className + ' { ' + style + '; }', getSheet().cssRules.length);
    } catch (err) {
      if (sheetEl) sheetEl.appendChild(document.createTextNode('.' + className + ' { ' + style + '; }\n'));
    }
    return className;
  }

  return { classFor };
})();

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
    return `<div class="sk-avatar ${sizeClass} ${extraClass} ${SKDynamicStyles.classFor('background:' + bg + ';color:white')}">${initials}</div>`;
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
      html += `<div class="sk-card sk-ex-a88071cf">
        <div class="sk-skeleton-row">
          <div class="sk-skeleton sk-skeleton-avatar"></div>
          <div class="sk-ex-97445a8d">
            <div class="sk-skeleton sk-skeleton-text w-2/3"></div>
            <div class="sk-skeleton sk-skeleton-text w-1/3"></div>
          </div>
        </div>
        <div class="sk-skeleton sk-skeleton-text sk-ex-43cfd349"></div>
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
        <div class="sk-ex-97445a8d">
          <div class="sk-skeleton sk-skeleton-text w-2/3"></div>
          <div class="sk-skeleton sk-skeleton-text w-1/2"></div>
        </div>
      </div>`;
    }
    return html;
  }

  function skeletonStats(count = 4) {
    let html = '<div class="sk-grid sk-grid-4 sk-ex-561f378b">';
    for (let i = 0; i < count; i++) {
      html += `<div class="sk-stat-card">
        <div class="sk-skeleton sk-skeleton-avatar"></div>
        <div class="sk-ex-97445a8d">
          <div class="sk-skeleton sk-skeleton-text w-1/3 sk-ex-54e74057"></div>
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
      html += '<th><div class="sk-skeleton sk-skeleton-text sk-ex-9035d7b8"></div></th>';
    }
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const w = c === 0 ? '60%' : c === 1 ? '80%' : '50%';
        html += `<td><div class="sk-skeleton sk-skeleton-text ${SKDynamicStyles.classFor('width:' + w + ';margin:0')}"></div></td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function skeletonChat() {
    return `<div class="sk-ex-d1c1702a">
      <div class="sk-ex-33a6ff4d">
        <div class="sk-skeleton sk-skeleton-avatar sk-avatar-sm"></div>
        <div class="sk-skeleton sk-ex-8109b7f1"></div>
      </div>
      <div class="sk-ex-619a791c">
        <div class="sk-skeleton sk-ex-706e034c"></div>
      </div>
      <div class="sk-ex-33a6ff4d">
        <div class="sk-skeleton sk-skeleton-avatar sk-avatar-sm"></div>
        <div class="sk-skeleton sk-ex-990fecc0"></div>
      </div>
      <div class="sk-ex-619a791c">
        <div class="sk-skeleton sk-ex-47f2f2e1"></div>
      </div>
    </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     CHAT BUBBLE
     ───────────────────────────────────────────────────────── */
  function chatBubble(body, isMe, time, senderName = '') {
    const dir = isMe ? 'sent' : 'received';
    const nameHtml = (!isMe && senderName) 
      ? `<div class="sk-ex-eecf4339">${esc(senderName)}</div>`
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
    return `<div id="${id}" class="sk-modal-overlay sk-ex-6b99de8b" onclick="if(event.target===this)SKComponents.closeModal('${id}')">
      <div class="sk-modal-panel ${SKDynamicStyles.classFor('max-width:' + maxWidth)}">
        <div class="sk-modal-header">
          <h3 class="sk-modal-title">${esc(title)}</h3>
          <button type="button" class="sk-modal-close" onclick="SKComponents.closeModal('${id}')" aria-label="Close" title="Close">
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
      <button type="button" class="sk-toast-dismiss" onclick="this.parentElement.remove()" aria-label="Dismiss notification" title="Dismiss notification">
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
        <div class="sk-modal-panel sk-ex-cb058518">
          <div class="sk-modal-header">
            <h3 class="sk-modal-title">${esc(title)}</h3>
          </div>
          <div class="sk-modal-body">
            <p class="sk-ex-6aa1944b">${esc(message)}</p>
          </div>
          <div class="sk-modal-footer">
            <button type="button" class="sk-btn sk-btn-secondary" id="${id}-cancel">${esc(cancelText)}</button>
            <button type="button" class="sk-btn ${danger}" id="${id}-confirm">${esc(confirmText)}</button>
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
      return `<button type="button" class="sk-tab ${isActive}" data-tab="${t.id}" onclick="${onSwitchFn}('${t.id}')">
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
      <input type="checkbox" id="${id}" aria-label="${esc(label)}" title="${esc(label)}" ${chk} onchange="${onChangeFn}">
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
    return `<div class="sk-page-header sk-ex-61701fbf">
      <div>
        <h1 class="sk-page-title">${esc(title)}</h1>
        ${subtitle ? `<p class="sk-page-subtitle">${esc(subtitle)}</p>` : ''}
      </div>
      ${actionsHtml ? `<div class="sk-ex-44eb278d">${actionsHtml}</div>` : ''}
    </div>`;
  }

  /* ─────────────────────────────────────────────────────────
     AVAILABILITY BADGE
     ───────────────────────────────────────────────────────── */
  function availabilityBadge(isAvailable, size = 'default') {
    if (isAvailable) {
      return `<span class="sk-badge sk-badge-success">
        <span class="sk-pulse-dot sk-ex-7936b8b6"></span>
        Available
      </span>`;
    }
    return `<span class="sk-badge sk-badge-neutral">
      <span class="sk-ex-7936b8b6"></span>
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
