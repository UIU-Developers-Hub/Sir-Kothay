/* ============================================================
   SIR KOTHAY — Theme Manager
   Dark / Light / System theme with persistence
   ============================================================ */

window.SKTheme = (() => {
  'use strict';

  const STORAGE_KEY = 'sk-theme';
  const THEMES = ['light', 'dark', 'system'];

  /**
   * Get the system's preferred color scheme
   * @returns {'light'|'dark'}
   */
  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Get the stored theme preference
   * @returns {'light'|'dark'|'system'}
   */
  function getStoredTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : 'system';
  }

  /**
   * Get the effective (resolved) theme
   * @returns {'light'|'dark'}
   */
  function getEffectiveTheme() {
    const pref = getStoredTheme();
    return pref === 'system' ? getSystemTheme() : pref;
  }

  /**
   * Apply theme to the document
   * @param {'light'|'dark'} theme
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Update meta theme-color for mobile browsers
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = theme === 'dark' ? '#1C1917' : '#FAFAF9';

    // Dispatch event for any listeners
    window.dispatchEvent(new CustomEvent('sk-theme-change', { detail: { theme } }));
  }

  /**
   * Set and persist theme preference
   * @param {'light'|'dark'|'system'} preference
   */
  function setTheme(preference) {
    localStorage.setItem(STORAGE_KEY, preference);
    applyTheme(preference === 'system' ? getSystemTheme() : preference);
    updateToggleUI();
  }

  /**
   * Toggle between light and dark (skips system)
   */
  function toggle() {
    const current = getEffectiveTheme();
    setTheme(current === 'light' ? 'dark' : 'light');
  }

  /**
   * Cycle through: light → dark → system → light
   */
  function cycle() {
    const stored = getStoredTheme();
    const idx = THEMES.indexOf(stored);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
  }

  /**
   * Update all theme toggle buttons on the page
   */
  function updateToggleUI() {
    const effective = getEffectiveTheme();
    const stored = getStoredTheme();

    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      const sunIcon = btn.querySelector('.theme-icon-light');
      const moonIcon = btn.querySelector('.theme-icon-dark');
      const systemIcon = btn.querySelector('.theme-icon-system');

      if (sunIcon) sunIcon.style.display = (effective === 'light' && stored !== 'system') ? '' : 'none';
      if (moonIcon) moonIcon.style.display = (effective === 'dark' && stored !== 'system') ? '' : 'none';
      if (systemIcon) systemIcon.style.display = stored === 'system' ? '' : 'none';
    });

    document.querySelectorAll('[data-theme-choice]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-theme-choice') === stored);
    });
  }

  /**
   * Create a theme toggle button HTML string
   * @returns {string}
   */
  function renderToggleButton() {
    return `
      <div class="sk-sidebar-theme-group" aria-label="Theme">
        <button type="button" data-theme-choice="system" onclick="SKTheme.set('system')" title="System theme">
          <i class="bi bi-circle-half"></i><span>System</span>
        </button>
        <button type="button" data-theme-choice="light" onclick="SKTheme.set('light')" title="Light theme">
          <i class="bi bi-sun"></i><span>Light</span>
        </button>
        <button type="button" data-theme-choice="dark" onclick="SKTheme.set('dark')" title="Dark theme">
          <i class="bi bi-moon-stars"></i><span>Dark</span>
        </button>
      </div>
    `;
  }

  /**
   * Initialize theme system
   */
  function init() {
    // Apply stored theme immediately
    applyTheme(getEffectiveTheme());

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getStoredTheme() === 'system') {
        applyTheme(getSystemTheme());
        updateToggleUI();
      }
    });

    // Set up toggle buttons after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateToggleUI);
    } else {
      updateToggleUI();
    }
  }

  // Auto-init immediately
  init();

  return {
    get: getEffectiveTheme,
    getStored: getStoredTheme,
    set: setTheme,
    toggle,
    cycle,
    renderToggleButton,
    updateToggleUI
  };
})();
