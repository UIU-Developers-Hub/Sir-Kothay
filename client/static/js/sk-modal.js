/* sk-modal.js — Reusable modal system for Sir Kothay.
   Usage:
     var id = skModal.open(htmlContent, { title, maxWidth, onClose });
     skModal.close(id);
     skModal.closeAll();
*/
(function () {
  var _counter = 0;
  var WIDTHS = {
    'max-w-sm': '24rem',
    'max-w-md': '28rem',
    'max-w-lg': '32rem',
    'max-w-xl': '36rem',
    'max-w-2xl': '42rem'
  };

  function escapeHtml(value) {
    var d = document.createElement('div');
    d.textContent = value == null ? '' : String(value);
    return d.innerHTML;
  }

  function resolveWidth(value) {
    if (!value) return '28rem';
    return WIDTHS[value] || value;
  }

  function open(html, opts) {
    opts = opts || {};
    var id = 'sk-modal-' + (++_counter);
    var maxW = resolveWidth(opts.maxWidth);
    var title = opts.title || '';

    var backdrop = document.createElement('div');
    backdrop.id = id;
    backdrop.className = 'sk-modal-overlay sk-modal-backdrop';
    backdrop.style.zIndex = opts.zIndex || 200;

    var headerClass = title ? 'sk-modal-header' : 'sk-modal-header compact';
    var titleHtml = title ? '<h3 class="sk-modal-title">' + escapeHtml(title) + '</h3>' : '<span></span>';

    backdrop.innerHTML =
      '<div class="sk-modal-panel" style="max-width:' + maxW + '">' +
        '<div class="' + headerClass + '">' +
          titleHtml +
          '<button class="sk-modal-close sk-modal-close-btn" aria-label="Close"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '<div class="sk-modal-body">' + html + '</div>' +
      '</div>';

    // Close on backdrop click
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) {
        close(id);
        if (opts.onClose) opts.onClose();
      }
    });

    // Close button
    backdrop.querySelector('.sk-modal-close-btn').addEventListener('click', function () {
      close(id);
      if (opts.onClose) opts.onClose();
    });

    document.body.appendChild(backdrop);
    return id;
  }

  function close(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  }

  function closeAll() {
    document.querySelectorAll('.sk-modal-backdrop').forEach(function (el) { el.remove(); });
  }

  window.skModal = { open: open, close: close, closeAll: closeAll };
})();
