/**
 * Semi-transparent overlay notifications (replaces window.alert / confirm).
 * Uses the shared Sir Kothay modal component styles.
 */
(function (global) {
    'use strict';

    var Z = '2147483000';

    function escapeHtml(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function removeBackdrop(backdrop, onKey) {
        if (onKey) document.removeEventListener('keydown', onKey);
        if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    function variantMeta(variant) {
        if (variant === 'success') {
            return { icon: 'bi-check-circle-fill', title: 'Success', tone: 'success' };
        }
        if (variant === 'error') {
            return { icon: 'bi-exclamation-circle-fill', title: 'Something went wrong', tone: 'error' };
        }
        return { icon: 'bi-info-circle-fill', title: 'Notice', tone: 'info' };
    }

    /**
     * @param {string} message
     * @param {{ variant?: 'info'|'success'|'error', title?: string }} [opts]
     * @returns {Promise<void>}
     */
    function skNotify(message, opts) {
        opts = opts || {};
        var variant = opts.variant || 'info';
        var meta = variantMeta(variant);
        var title = opts.title != null ? String(opts.title) : meta.title;

        return new Promise(function (resolve) {
            var backdrop = document.createElement('div');
            backdrop.className = 'sk-modal-overlay';
            backdrop.style.zIndex = Z;
            backdrop.setAttribute('role', 'presentation');

            var panel = document.createElement('div');
            panel.className = 'sk-modal-panel';
            panel.style.maxWidth = '28rem';
            panel.setAttribute('role', 'alertdialog');
            panel.setAttribute('aria-modal', 'true');
            panel.setAttribute('aria-labelledby', 'sk-notify-title');

            panel.innerHTML =
                '<div class="sk-modal-body">' +
                  '<div class="sk-dialog-layout">' +
                    '<div class="sk-dialog-icon ' + meta.tone + '"><i class="bi ' + meta.icon + '" aria-hidden="true"></i></div>' +
                    '<div class="sk-dialog-content">' +
                      '<h3 id="sk-notify-title" class="sk-modal-title">' + escapeHtml(title) + '</h3>' +
                      '<p class="sk-dialog-message sk-notify-msg"></p>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="sk-modal-footer">' +
                  '<button type="button" class="sk-notify-ok sk-btn sk-btn-primary">OK</button>' +
                '</div>';

            var msgEl = panel.querySelector('.sk-notify-msg');
            msgEl.textContent = message;

            var onKey = function (e) {
                if (e.key === 'Escape') finish();
            };

            function finish() {
                removeBackdrop(backdrop, onKey);
                resolve();
            }

            panel.querySelector('.sk-notify-ok').addEventListener('click', finish);
            backdrop.addEventListener('click', function (e) {
                if (e.target === backdrop) finish();
            });

            backdrop.appendChild(panel);
            document.body.appendChild(backdrop);
            document.addEventListener('keydown', onKey);
            setTimeout(function () {
                var b = panel.querySelector('.sk-notify-ok');
                if (b) b.focus();
            }, 0);
        });
    }

    /**
     * @param {string} message
     * @param {{ title?: string, confirmText?: string, cancelText?: string, danger?: boolean }} [opts]
     * @returns {Promise<boolean>}
     */
    function skConfirm(message, opts) {
        opts = opts || {};
        var confirmText = opts.confirmText || 'Confirm';
        var cancelText = opts.cancelText || 'Cancel';
        var title = opts.title != null ? String(opts.title) : 'Please confirm';
        var danger = !!opts.danger;

        return new Promise(function (resolve) {
            var backdrop = document.createElement('div');
            backdrop.className = 'sk-modal-overlay';
            backdrop.style.zIndex = Z;

            var panel = document.createElement('div');
            panel.className = 'sk-modal-panel';
            panel.style.maxWidth = '28rem';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'true');

            var confirmClass = danger ? 'sk-btn sk-btn-danger' : 'sk-btn sk-btn-primary';

            panel.innerHTML =
                '<div class="sk-modal-body">' +
                  '<h3 class="sk-modal-title">' + escapeHtml(title) + '</h3>' +
                  '<p class="sk-dialog-message sk-confirm-msg"></p>' +
                '</div>' +
                '<div class="sk-modal-footer">' +
                  '<button type="button" class="sk-confirm-cancel sk-btn sk-btn-secondary">' + escapeHtml(cancelText) + '</button>' +
                  '<button type="button" class="sk-confirm-yes ' + confirmClass + '">' + escapeHtml(confirmText) + '</button>' +
                '</div>';

            panel.querySelector('.sk-confirm-msg').textContent = message;

            var onKey = function (e) {
                if (e.key === 'Escape') finish(false);
            };

            function finish(yes) {
                removeBackdrop(backdrop, onKey);
                resolve(!!yes);
            }

            panel.querySelector('.sk-confirm-yes').addEventListener('click', function () {
                finish(true);
            });
            panel.querySelector('.sk-confirm-cancel').addEventListener('click', function () {
                finish(false);
            });
            backdrop.addEventListener('click', function (e) {
                if (e.target === backdrop) finish(false);
            });

            backdrop.appendChild(panel);
            document.body.appendChild(backdrop);
            document.addEventListener('keydown', onKey);
            setTimeout(function () {
                var b = panel.querySelector('.sk-confirm-yes');
                if (b) b.focus();
            }, 0);
        });
    }

    global.skNotify = skNotify;
    global.skConfirm = skConfirm;
})(typeof window !== 'undefined' ? window : this);
