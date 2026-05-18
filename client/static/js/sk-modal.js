/* sk-modal.js — Reusable modal system for Sir Kothay.
   Usage:
     var id = skModal.open(htmlContent, { title, maxWidth, onClose });
     skModal.close(id);
     skModal.closeAll();
*/
(function () {
  var _counter = 0;

  function open(html, opts) {
    opts = opts || {};
    var id = 'sk-modal-' + (++_counter);
    var maxW = opts.maxWidth || 'max-w-md';
    var title = opts.title || '';

    var backdrop = document.createElement('div');
    backdrop.id = id;
    backdrop.className = 'fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm z-[200] sk-modal-backdrop';
    backdrop.style.animation = 'skModalFadeIn 0.2s ease-out';

    var titleHtml = title ? '<h3 class="font-bold text-gray-900 text-lg mb-4">' + title + '</h3>' : '';

    backdrop.innerHTML =
      '<div class="bg-white rounded-3xl shadow-2xl ' + maxW + ' w-full p-6 border border-gray-100 relative transform transition-all max-h-[90vh] overflow-y-auto">' +
        '<button class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors sk-modal-close-btn" aria-label="Close">' +
          '<i class="bi bi-x-lg"></i>' +
        '</button>' +
        titleHtml +
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

  // Inject keyframe animation
  if (!document.getElementById('sk-modal-styles')) {
    var style = document.createElement('style');
    style.id = 'sk-modal-styles';
    style.textContent = '@keyframes skModalFadeIn { from { opacity: 0; } to { opacity: 1; } }';
    document.head.appendChild(style);
  }

  window.skModal = { open: open, close: close, closeAll: closeAll };
})();
