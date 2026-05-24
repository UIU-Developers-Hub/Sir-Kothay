/* ============================================================
   SIR KOTHAY — Shared Utilities
   Single source of truth — no duplicates across files
   ============================================================ */

window.SKUtils = (() => {
  'use strict';

  /**
   * Escape HTML entities to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Relative time string (e.g., "2 hours ago")
   * @param {string|Date} dateStr
   * @returns {string}
   */
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);

    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
  }

  /**
   * Format date for display
   * @param {string|Date} dateStr
   * @param {object} [options]
   * @returns {string}
   */
  function formatDate(dateStr, options = {}) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    });
  }

  /**
   * Format time for display
   * @param {string|Date} dateStr
   * @returns {string}
   */
  function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Convert value to API-compatible ISO datetime
   */
  function toApiDateTime(v) {
    if (!v) return null;
    return new Date(v).toISOString();
  }

  /**
   * Convert ISO string to datetime-local input value
   */
  function toLocalDateTimeInput(v) {
    if (!v) return '';
    const d = new Date(v);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /**
   * Debounce a function
   * @param {Function} fn
   * @param {number} delay - ms
   * @returns {Function}
   */
  function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * Copy text to clipboard with fallback
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a consistent HSL color from a string
   * @param {string} str
   * @returns {string} HSL color
   */
  function stringToColor(str) {
    if (!str) return 'hsl(0, 60%, 60%)';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 55%, 55%)`;
  }

  /**
   * Get initials from a name
   * @param {string} name
   * @returns {string}
   */
  function getInitials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  /**
   * Truncate text with ellipsis
   * @param {string} text
   * @param {number} maxLen
   * @returns {string}
   */
  function truncate(text, maxLen = 100) {
    if (!text || text.length <= maxLen) return text || '';
    return text.slice(0, maxLen).trim() + '…';
  }

  /**
   * Parse URL query parameters
   * @returns {URLSearchParams}
   */
  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  /**
   * Generate a unique ID
   * @param {string} [prefix]
   * @returns {string}
   */
  function uid(prefix = 'sk') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * Day names and short names
   */
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /**
   * Resolve a profile image URL
   * @param {string} url
   * @returns {string}
   */
  function resolveProfileImage(url) {
    if (!url) return '../static/images/image.png';
    if (url.startsWith('http')) return url;
    // Assume API_BASE_URL is globally available via api-config.js
    if (typeof API_BASE_URL !== 'undefined') {
      return API_BASE_URL + (url.startsWith('/') ? '' : '/') + url;
    }
    return url;
  }

  return {
    escapeHtml,
    timeAgo,
    formatDate,
    formatTime,
    toApiDateTime,
    toLocalDateTimeInput,
    debounce,
    copyToClipboard,
    stringToColor,
    getInitials,
    truncate,
    getParams,
    uid,
    resolveProfileImage,
    DAY_NAMES,
    DAY_SHORT
  };
})();

/* Convenience aliases for backward compatibility.
   Use window properties instead of global consts so older dashboard files
   that declare function escapeHtml/timeAgo do not fail at parse time. */
window.escapeHtml = window.escapeHtml || SKUtils.escapeHtml;
window.timeAgo = window.timeAgo || SKUtils.timeAgo;
