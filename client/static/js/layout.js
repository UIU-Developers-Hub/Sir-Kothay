/* ============================================================
   SIR KOTHAY — Layout Controller
   Sidebar, Topbar, Bottom Nav, Auth guard, User data
   ============================================================ */

window.SKLayout = (() => {
  'use strict';

  let _user = null;
  let _userDetails = null;
  let _lastUserLoadError = null;
  let _sidebarOpen = false;
  let _currentPage = '';
  let _lastInitOptions = null;
  let _lastPublicPage = '';
  let _backendRestoreBound = false;
  let _backendRestorePending = false;
  let _backendRestoreInFlight = false;
  const _navBadges = {};

  /* ─────────────────────────────────────────────────────────
     AUTH
     ───────────────────────────────────────────────────────── */
  function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) {
      window.location.href = getRelativePath('auth/login.html');
      return false;
    }
    return true;
  }

  function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('sk_otp_expires_at');
    window.location.href = getRelativePath('auth/login.html');
  }

  function getRelativePath(target) {
    // Determine base path from current location
    const path = window.location.pathname;
    if (path.includes('/dashboard/') || path.includes('/broadcast/')) {
      return '../' + target;
    }
    if (path.includes('/auth/')) {
      return '../' + target;
    }
    return target;
  }

  /* ─────────────────────────────────────────────────────────
     USER DATA
     ───────────────────────────────────────────────────────── */
  async function loadUser() {
    if (_user) return _user;
    _lastUserLoadError = null;
    try {
      const res = await apiRequest(API_ENDPOINTS.CURRENT_USER);
      if (res.ok) {
        _user = await res.json();
        return _user;
      }
      _lastUserLoadError = (res.status === 401 || res.status === 403) ? 'auth' : 'server';
    } catch (e) {
      _lastUserLoadError = 'unavailable';
      console.error('Failed to load user:', e);
    }
    return null;
  }

  async function loadUserDetails() {
    if (_userDetails) return _userDetails;
    try {
      const res = await apiRequest(API_ENDPOINTS.USER_DETAILS);
      if (res.ok) {
        _userDetails = await res.json();
        return _userDetails;
      }
    } catch (e) {
      console.error('Failed to load user details:', e);
    }
    return null;
  }

  function getUser() { return _user; }
  function getUserDetails() { return _userDetails; }

  function clearUserCache() {
    _user = null;
    _userDetails = null;
  }

  function markBackendUnavailable(reason) {
    if (window.SKBackendStatus && SKBackendStatus.markOffline) {
      SKBackendStatus.markOffline({ reason: reason || 'layout-load' });
    }
  }

  async function resolveBackendState(reason) {
    if (!window.SKBackendStatus || !SKBackendStatus.getState) return 'online';
    let status = SKBackendStatus.getState();
    if (status === 'unknown' && SKBackendStatus.check) {
      status = await SKBackendStatus.check(reason || 'layout-check');
    }
    return status;
  }

  function renderBackendUnavailableState(options) {
    options = options || {};
    const loadingState = document.getElementById('loadingState');
    if (!loadingState) return;
    loadingState.classList.remove('hidden');
    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.classList.add('hidden');
    loadingState.innerHTML = `
      <div class="sk-empty-state compact">
        <div class="sk-empty-icon"><i class="bi ${options.icon || 'bi-wifi-off'}"></i></div>
        <div class="sk-empty-title">${SKUtils.escapeHtml(options.title || 'Backend unavailable')}</div>
        <div class="sk-empty-subtitle">${SKUtils.escapeHtml(options.subtitle || 'You are still signed in. Sir Kothay will reconnect automatically.')}</div>
        <button type="button" class="sk-btn sk-btn-primary sk-btn-sm" onclick="SKLayout.retryBackend()">
          <i class="bi bi-arrow-clockwise"></i> Retry
        </button>
      </div>
    `;
  }

  async function retryBackend() {
    if (window.SKBackendStatus && SKBackendStatus.check) {
      const status = await SKBackendStatus.check('manual-retry');
      if (status === 'online') handleBackendRestored({ reason: 'manual-retry' });
      return status;
    }
    handleBackendRestored({ reason: 'manual-retry' });
    return 'unknown';
  }

  function bindBackendRestoreHandler() {
    if (_backendRestoreBound) return;
    _backendRestoreBound = true;
    window.addEventListener('sk:backend-status', (event) => {
      const detail = event.detail || {};
      if (detail.status === 'offline') {
        handleBackendOffline(detail);
        return;
      }
      if (detail.status === 'online') {
        if (!_backendRestorePending && detail.previous !== 'offline') return;
        handleBackendRestored(detail);
      }
    });
  }

  function waitForBackendRestore() {
    _backendRestorePending = true;
    bindBackendRestoreHandler();
  }

  function handleBackendOffline(detail) {
    _backendRestorePending = true;
    renderOfflineStaticNav(_lastPublicPage || getPublicPage(), { hideAuth: true });
    if (_lastInitOptions && (_lastInitOptions.type === 'dashboard' || _lastInitOptions.type === 'verify')) {
      renderBackendUnavailableState({
        title: 'Backend unavailable',
        subtitle: 'You are still signed in. Sir Kothay will reconnect automatically.'
      });
    }
    bindBackendRestoreHandler();
  }

  async function handleBackendRestored(detail) {
    if (_backendRestoreInFlight) return;
    _backendRestoreInFlight = true;
    try {
      clearUserCache();
      if (_lastInitOptions && _lastInitOptions.type === 'dashboard') {
        await initDashboardLayout(_lastInitOptions.page, _lastInitOptions.onReady);
      } else if (_lastInitOptions && _lastInitOptions.type === 'verify') {
        await initVerifyLayout(_lastInitOptions.onReady);
      } else if (_lastPublicPage) {
        await setupPublicNav(_lastPublicPage);
      }
      _backendRestorePending = false;
      if (typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('sk:backend-restored', {
          detail: Object.assign({ source: 'layout' }, detail || {})
        }));
      }
    } finally {
      _backendRestoreInFlight = false;
    }
  }

  function settingsHrefForRole(role) {
    if (role === 'FACULTY') return getRelativePath('dashboard/home.html?tab=fc-settings');
    if (role === 'STUDENT') return getRelativePath('dashboard/student.html?tab=settings');
    return '';
  }

  function profileHrefForRole(role) {
    if (role === 'FACULTY') return getRelativePath('dashboard/home.html?tab=profile');
    if (role === 'STUDENT') return getRelativePath('dashboard/student.html?tab=profile');
    return getRelativePath('dashboard/admin.html');
  }

  function renderThemeGroup() {
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

  function renderAccountFooter(user, details, role, options) {
    options = options || {};
    const avatarSrc = details?.profile_image ? resolveProfileImage(details.profile_image) : null;
    const displayName = user.username || user.email;
    const profileTag = options.staticProfile ? 'div' : 'a';
    const profileHref = options.staticProfile ? '' : ` href="${profileHrefForRole(role)}"`;
    const profileStyle = options.staticProfile ? ' style="cursor:default; pointer-events:none;"' : '';
    const settingsHref = settingsHrefForRole(role);
    const hasSettings = !!settingsHref;
    const profileActive = options.activePage === 'profile' || _currentPage === 'profile';
    const settingsActive = options.activePage === 'settings' || _currentPage === 'settings';

    return `
      ${renderThemeGroup()}
      <div class="sk-sidebar-account-row ${hasSettings ? '' : 'no-settings'}">
        <${profileTag}${profileHref} class="sk-sidebar-profile-button ${profileActive ? 'active' : ''}" data-page="profile"${profileStyle} title="Profile">
          ${SKComponents.avatar(avatarSrc, displayName, 'sm')}
          <span>${SKUtils.escapeHtml(displayName)}</span>
        </${profileTag}>
        ${hasSettings ? `<a href="${settingsHref}" class="sk-sidebar-settings-button ${settingsActive ? 'active' : ''}" data-page="settings" title="Settings" aria-label="Settings">
          <i class="bi bi-gear"></i>
        </a>` : ''}
        <button class="sk-sidebar-signout-button" onclick="SKLayout.logout()" title="Sign out" aria-label="Sign out">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    `;
  }

  function hasRealNavContent(el) {
    return !!(el && el.children.length && !el.querySelector('[data-nav-skeleton]'));
  }

  function renderNavSkeleton(options) {
    options = options || {};
    const sidebarNav = document.querySelector('.sk-sidebar-nav');
    const sidebarFooter = document.querySelector('.sk-sidebar-footer');
    const bottomNavItems = document.querySelector('.sk-bottom-nav-items');
    const includeAccount = !!options.includeAccount;

    if (sidebarNav && !hasRealNavContent(sidebarNav)) {
      sidebarNav.innerHTML = `
        <div class="sk-sidebar-desktop-menu sk-nav-skeleton" data-nav-skeleton aria-hidden="true">
          <div class="sk-sidebar-section">
            <div class="sk-sidebar-section-title">Menu</div>
            ${[72, 84, 68, 78].map(width => `
              <div class="sk-nav-skeleton-link">
                <span class="sk-nav-skeleton-icon sk-skeleton"></span>
                <span class="sk-nav-skeleton-text sk-skeleton" style="width:${width}%"></span>
              </div>
            `).join('')}
          </div>
          <div class="sk-sidebar-site-links">
            <div class="sk-sidebar-divider"></div>
            <div class="sk-sidebar-section">
              <div class="sk-sidebar-section-title">Website</div>
              ${[62, 54, 66].map(width => `
                <div class="sk-nav-skeleton-link compact">
                  <span class="sk-nav-skeleton-icon sk-skeleton"></span>
                  <span class="sk-nav-skeleton-text sk-skeleton" style="width:${width}%"></span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    if (sidebarFooter && !hasRealNavContent(sidebarFooter)) {
      sidebarFooter.innerHTML = `
        ${renderThemeGroup()}
        ${includeAccount ? `
          <div class="sk-sidebar-account-row sk-nav-skeleton-account" data-nav-skeleton aria-hidden="true">
            <span class="sk-nav-skeleton-profile">
              <span class="sk-skeleton sk-skeleton-avatar"></span>
              <span class="sk-nav-skeleton-text sk-skeleton"></span>
            </span>
            <span class="sk-nav-skeleton-action sk-skeleton"></span>
            <span class="sk-nav-skeleton-action sk-skeleton"></span>
          </div>
        ` : ''}
      `;
      if (window.SKTheme && SKTheme.updateToggleUI) {
        SKTheme.updateToggleUI();
      }
    }

    if (bottomNavItems && !hasRealNavContent(bottomNavItems)) {
      bottomNavItems.innerHTML = [64, 72, 58, 66].map(width => `
        <span class="sk-bottom-nav-skeleton-item" data-nav-skeleton aria-hidden="true">
          <span class="sk-bottom-nav-skeleton-icon sk-skeleton"></span>
          <span class="sk-bottom-nav-skeleton-label sk-skeleton" style="width:${width}%"></span>
        </span>
      `).join('');
    }
  }

  /* ─────────────────────────────────────────────────────────
     SIDEBAR GENERATION
     ───────────────────────────────────────────────────────── */
  function getSidebarLinks(role, isStaff) {
    const links = [];

    if (role === 'FACULTY') {
      links.push(
        { id: 'broadcast', icon: 'megaphone', label: 'Broadcast', href: getRelativePath('dashboard/home.html?tab=messages') },
        { id: 'templates', icon: 'lightning', label: 'Quick Status', href: getRelativePath('dashboard/home.html?tab=templates') },
        { id: 'calendar', icon: 'calendar3', label: 'Calendar', href: getRelativePath('dashboard/home.html?tab=calendar') },
        { id: 'inbox', icon: 'chat-dots', label: 'Messages', href: getRelativePath('dashboard/home.html?tab=inbox') }
      );
    } else if (role === 'STUDENT') {
      links.push(
        { id: 'faculties', icon: 'people', label: 'My Faculties', href: getRelativePath('dashboard/student.html?tab=faculties') },
        { id: 'messages', icon: 'chat-dots', label: 'Messages', href: getRelativePath('dashboard/student.html?tab=messages') },
        { id: 'feed', icon: 'rss', label: 'Updates', href: getRelativePath('dashboard/student.html?tab=feed') }
      );
    }

    // Admin goes to its own sidebar section, NOT in bottom nav
    if (isStaff) {
      links.push({ id: 'admin', icon: 'shield-lock', label: 'Admin Panel', href: getRelativePath('dashboard/admin.html'), section: 'admin' });
    }

    return links;
  }

  function getSiteLinks(role, isStaff) {
    const links = [
      { id: 'home', icon: 'house', label: 'Home', href: getRelativePath('index.html') },
      { id: 'about', icon: 'info-circle', label: 'About', href: getRelativePath('about.html') },
      { id: 'github', icon: 'github', label: 'GitHub', href: 'https://github.com/UIU-Developers-Hub/Sir-Kothay', external: true }
    ];
    return links;
  }

  function getActiveDashboardPage(page, role) {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.endsWith('/admin.html')) return 'admin';
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (role === 'FACULTY' && path.endsWith('/home.html')) {
      const map = {
        messages: 'broadcast',
        broadcast: 'broadcast',
        templates: 'templates',
        schedules: 'calendar',
        calendar: 'calendar',
        inbox: 'inbox',
        'fc-settings': 'settings',
        profile: 'profile'
      };
      return map[tab] || 'broadcast';
    }

    if (role === 'STUDENT' && path.endsWith('/student.html')) {
      const map = {
        faculties: 'faculties',
        messages: 'messages',
        feed: 'feed',
        settings: 'settings',
        profile: 'profile'
      };
      return map[tab] || 'faculties';
    }

    return page;
  }

  function renderSidebar(links, activePage) {
    const mainLinks = links.filter(l => !l.section);
    const adminLinks = links.filter(l => l.section === 'admin');

    let navHtml = '<div class="sk-sidebar-desktop-menu"><div class="sk-sidebar-section sk-sidebar-tabs">';
    navHtml += '<div class="sk-sidebar-section-title">Menu</div>';
    mainLinks.forEach(l => {
      const active = l.id === activePage ? 'active' : '';
      const badgeValue = Number(_navBadges[l.id]) || 0;
      const badgeHtml = badgeValue > 0 ? `<span class="sk-sidebar-badge sk-nav-badge">${badgeValue > 99 ? '99+' : badgeValue}</span>` : '';
      navHtml += `<a href="${l.href}" class="sk-sidebar-link ${active}" data-page="${l.id}">
        <i class="bi bi-${l.icon}"></i>
        <span class="sk-sidebar-link-text">${SKUtils.escapeHtml(l.label)}</span>
        ${badgeHtml}
      </a>`;
    });
    navHtml += '</div>';

    if (adminLinks.length) {
      navHtml += '<div class="sk-sidebar-section">';
      navHtml += '<div class="sk-sidebar-section-title">Administration</div>';
      adminLinks.forEach(l => {
        const active = l.id === activePage ? 'active' : '';
        navHtml += `<a href="${l.href}" class="sk-sidebar-link ${active}" data-page="${l.id}">
          <i class="bi bi-${l.icon}"></i>
          <span class="sk-sidebar-link-text">${SKUtils.escapeHtml(l.label)}</span>
        </a>`;
      });
      navHtml += '</div>';
    }

    navHtml += '</div>';

    return navHtml;
  }

  function renderSiteSidebar(role, isStaff, activePage) {
    const links = getSiteLinks(role, isStaff);
    let html = '<div class="sk-sidebar-site-links"><div class="sk-sidebar-divider"></div><div class="sk-sidebar-section">';
    html += '<div class="sk-sidebar-section-title">Website</div>';
    links.forEach(l => {
      const active = l.id === activePage ? 'active' : '';
      const external = l.external ? ' target="_blank" rel="noopener"' : '';
      html += `<a href="${l.href}" class="sk-sidebar-link ${active}" data-page="${l.id}"${external}>
        <i class="bi bi-${l.icon}"></i>
        <span class="sk-sidebar-link-text">${SKUtils.escapeHtml(l.label)}</span>
      </a>`;
    });
    html += '</div></div>';
    return html;
  }

  function renderBottomNav(links, activePage) {
    // Filter out admin and bottom-section links — only core dashboard tabs go in the bottom bar
    let mainLinks = links.filter(l => !l.section);
    const hasFacultyNav = mainLinks.some(l => l.id === 'broadcast');
    if (hasFacultyNav) {
      const priority = ['broadcast', 'templates', 'calendar', 'inbox'];
      mainLinks = priority.map(id => mainLinks.find(l => l.id === id)).filter(Boolean);
    } else {
      mainLinks = mainLinks.slice(0, 4);
    }

    let items = [
      { id: 'menu', icon: 'list', label: 'Menu', href: '#', action: 'SKLayout.toggleSidebar(); return false;' },
      ...mainLinks
    ];

    return items.map(l => {
      const active = l.id === activePage ? 'active' : '';
      const action = l.action ? ` onclick="${l.action}"` : '';
      const badgeValue = Number(_navBadges[l.id]) || 0;
      const badgeHtml = badgeValue > 0 ? `<span class="sk-bottom-nav-badge sk-nav-badge">${badgeValue > 99 ? '99+' : badgeValue}</span>` : '';
      return `<a href="${l.href}" class="sk-bottom-nav-item ${active}" data-page="${l.id}"${action}>
        <i class="bi bi-${l.icon}"></i>
        <span>${SKUtils.escapeHtml(l.label)}</span>
        ${badgeHtml}
      </a>`;
    }).join('');
  }

  function setNavBadge(pageId, count) {
    const value = Number(count) || 0;
    _navBadges[pageId] = value;
    const label = value > 99 ? '99+' : String(value);
    document.querySelectorAll('[data-page="' + pageId + '"]').forEach(el => {
      let badge = el.querySelector('.sk-nav-badge');
      if (value <= 0) {
        if (badge) badge.remove();
        el.removeAttribute('data-has-badge');
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = el.classList.contains('sk-sidebar-link')
          ? 'sk-sidebar-badge sk-nav-badge'
          : 'sk-bottom-nav-badge sk-nav-badge';
        el.appendChild(badge);
      }
      badge.textContent = label;
      el.setAttribute('data-has-badge', 'true');
    });
  }

  /* ─────────────────────────────────────────────────────────
     SIDEBAR INTERACTIONS
     ───────────────────────────────────────────────────────── */
  function openSidebar() {
    const sidebar = document.querySelector('.sk-sidebar');
    const overlay = document.querySelector('.sk-sidebar-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
    _sidebarOpen = true;
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    const sidebar = document.querySelector('.sk-sidebar');
    const overlay = document.querySelector('.sk-sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    _sidebarOpen = false;
    document.body.style.overflow = '';
  }

  function toggleSidebar() {
    _sidebarOpen ? closeSidebar() : openSidebar();
  }

  /* ─────────────────────────────────────────────────────────
     INIT LAYOUT
     ───────────────────────────────────────────────────────── */
  async function init(options = {}) {
    const {
      page = 'dashboard',
      requireAuth = true,
      onReady = null,
      type = 'dashboard' // 'dashboard' | 'public' | 'auth'
    } = options;

    _currentPage = page;
    _lastInitOptions = { page, requireAuth, onReady, type };
    bindBackendRestoreHandler();

    // Auth check
    if (requireAuth && !checkAuth()) return;

    // For dashboard layouts, build the shell
    if (type === 'dashboard') {
      await initDashboardLayout(page, onReady);
    } else if (type === 'verify') {
      await initVerifyLayout(onReady);
    } else if (onReady) {
      onReady();
    }
  }

  async function initDashboardLayout(page, onReady) {
    renderNavSkeleton({ includeAccount: true });

    const backendState = await resolveBackendState('dashboard-layout-init');
    if (backendState !== 'online') {
      renderOfflineStaticNav(getPublicPage(), { hideAuth: true });
      renderBackendUnavailableState();
      waitForBackendRestore();
      return;
    }

    // Load user data
    const user = await loadUser();
    if (!user) {
      if (_lastUserLoadError === 'auth') {
        logout();
      } else if (_lastUserLoadError === 'server') {
        renderOfflineStaticNav(getPublicPage(), { hideAuth: true });
        renderBackendUnavailableState({
          icon: 'bi-exclamation-triangle',
          title: 'Could not load dashboard',
          subtitle: 'You are still signed in. Retry in a moment.'
        });
        waitForBackendRestore();
      } else {
        markBackendUnavailable('dashboard-init');
        renderOfflineStaticNav(getPublicPage(), { hideAuth: true });
        renderBackendUnavailableState();
        waitForBackendRestore();
      }
      return;
    }

    // --- VERIFICATION GATE ---
    if (user.is_email_verified === false) {
      if (!window.location.href.includes('verify-email.html')) {
        window.location.href = getRelativePath('auth/verify-email.html');
      }
      return;
    }

    const details = await loadUserDetails();
    const role = user.role || '';
    const isStaff = user.is_staff || false;

    const links = getSidebarLinks(role, isStaff);
    const activePage = getActiveDashboardPage(page, role);

    // Populate sidebar nav
    const sidebarNav = document.querySelector('.sk-sidebar-nav');
    if (sidebarNav) {
      sidebarNav.innerHTML = renderSidebar(links, activePage) + renderSiteSidebar(role, isStaff, activePage);
    }

    // Populate sidebar user footer
    const sidebarFooter = document.querySelector('.sk-sidebar-footer');
    if (sidebarFooter) {
      sidebarFooter.innerHTML = renderAccountFooter(user, details, role, { activePage: activePage });
    }

    // Populate bottom nav
    const bottomNavItems = document.querySelector('.sk-bottom-nav-items');
    if (bottomNavItems) {
      bottomNavItems.innerHTML = renderBottomNav(links, activePage);
    }

    // --- Instant tab switching for same-page nav links ---
    wireTabNavigation(role);

    // Set up sidebar overlay click
    const overlay = document.querySelector('.sk-sidebar-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
    }

    // Set up menu toggle
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', toggleSidebar);
    }

    // Handle Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _sidebarOpen) closeSidebar();
    });

    // Theme toggle is auto-initialized by theme.js
    if (window.SKTheme && SKTheme.updateToggleUI) {
      SKTheme.updateToggleUI();
    }

    // Callback
    if (onReady) onReady(user, details);
  }

  async function initVerifyLayout(onReady) {
    const backendState = await resolveBackendState('verify-layout-init');
    if (backendState !== 'online') {
      renderOfflineStaticNav(getPublicPage(), { hideAuth: true });
      renderBackendUnavailableState();
      waitForBackendRestore();
      return;
    }

    const user = await loadUser();
    if (!user) {
      if (_lastUserLoadError === 'auth') {
        logout();
      } else if (_lastUserLoadError === 'server') {
        renderOfflineStaticNav(getPublicPage(), { hideAuth: true });
        renderBackendUnavailableState({
          icon: 'bi-exclamation-triangle',
          title: 'Could not load account',
          subtitle: 'You are still signed in. Retry in a moment.'
        });
        waitForBackendRestore();
      } else {
        markBackendUnavailable('verify-init');
        renderOfflineStaticNav(getPublicPage(), { hideAuth: true });
        renderBackendUnavailableState();
        waitForBackendRestore();
      }
      return;
    }

    const details = await loadUserDetails();

    // 1. Inject Sidebar HTML if not present
    if (!document.querySelector('.sk-sidebar')) {
      const logoPath = getRelativePath('static/images/nav-logo.png');
      const sidebarHtml = `
        <aside class="sk-sidebar">
          <div class="sk-sidebar-logo">
            <img src="${logoPath}" alt="Sir Kothay">
          </div>
          <nav class="sk-sidebar-nav"></nav>
          <div class="sk-sidebar-footer"></div>
        </aside>
        <div class="sk-sidebar-overlay"></div>
      `;
      const appContainer = document.querySelector('.sk-app') || document.body;
      appContainer.insertAdjacentHTML('afterbegin', sidebarHtml);

      const overlay = document.querySelector('.sk-sidebar-overlay');
      if (overlay) overlay.addEventListener('click', closeSidebar);
    }
    
    // Inject Bottom Nav HTML if not present
    if (!document.querySelector('.sk-bottom-nav')) {
      const bnavHtml = `
        <nav class="sk-bottom-nav">
          <div class="sk-bottom-nav-items"></div>
        </nav>
      `;
      const appContainer = document.querySelector('.sk-app') || document.body;
      appContainer.insertAdjacentHTML('beforeend', bnavHtml);
    }

    const sidebarNav = document.querySelector('.sk-sidebar-nav');
    const sidebarFooter = document.querySelector('.sk-sidebar-footer');
    const mobileNav = document.querySelector('.sk-bottom-nav-items');

    if (sidebarNav) {
      sidebarNav.innerHTML = ''; // Empty nav for restricted access
    }

    if (sidebarFooter) {
      sidebarFooter.innerHTML = renderAccountFooter(user, details, user.role || '', { staticProfile: true });
    }

    if (mobileNav) {
      mobileNav.innerHTML = `
        <button id="menuToggle" class="sk-bottom-nav-item sk-bottom-nav-menu" onclick="SKLayout.toggleSidebar()">
          <i class="bi bi-list"></i><span>Menu</span>
        </button>
        <button onclick="SKLayout.logout()" class="sk-bottom-nav-item danger">
          <i class="bi bi-box-arrow-right"></i><span>Sign Out</span>
        </button>
      `;
    }

    // Escape key to close sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _sidebarOpen) closeSidebar();
    });

    if (window.SKTheme && SKTheme.updateToggleUI) {
      SKTheme.updateToggleUI();
    }

    if (onReady) onReady(user, details);
  }

  /**
   * Intercept sidebar & bottom-nav link clicks that target tabs on the
   * current page. Instead of reloading the whole page, trigger the
   * hidden proxy tab button so the switch is instant.
   */
  function wireTabNavigation(role) {
    // Build a map of sidebar-link id → hidden tab data-tab name
    const tabMap = {};
    if (role === 'FACULTY') {
      tabMap.broadcast = 'messages';
      tabMap.templates = 'templates';
      tabMap.calendar  = 'calendar';
      tabMap.inbox     = 'inbox';
      tabMap.settings  = 'fc-settings';
      tabMap.profile   = 'profile';
    } else if (role === 'STUDENT') {
      tabMap.faculties = 'faculties';
      tabMap.messages  = 'messages';
      tabMap.feed      = 'feed';
      tabMap.settings  = 'settings';
      tabMap.profile   = 'profile';
    }

    // Attach click handler to every sidebar and bottom-nav link
    document.querySelectorAll('.sk-sidebar-link[data-page], .sk-bottom-nav-item[data-page], .sk-sidebar-profile-button[data-page], .sk-sidebar-settings-button[data-page]').forEach(el => {
      const pageId = el.getAttribute('data-page');
      const targetTab = tabMap[pageId];
      if (!targetTab) return; // Not a tab link — let it navigate normally

      el.addEventListener('click', (e) => {
        // Find the hidden proxy tab button
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
        if (tabBtn) {
          e.preventDefault();
          tabBtn.click();

          // Update active states on sidebar and bottom nav
          document.querySelectorAll('.sk-sidebar-link.active, .sk-bottom-nav-item.active, .sk-sidebar-profile-button.active, .sk-sidebar-settings-button.active').forEach(a => a.classList.remove('active'));
          document.querySelectorAll(`[data-page="${pageId}"]`).forEach(a => a.classList.add('active'));

          // Close mobile sidebar if open
          if (_sidebarOpen) closeSidebar();
        }
        // If no tab button found, let default <a> navigation happen
      });
    });
  }

  /* ─────────────────────────────────────────────────────────
     PUBLIC HELPERS
     ───────────────────────────────────────────────────────── */
  function getPublicPage() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.endsWith('/about.html')) return 'about';
    if (path.endsWith('/login.html')) return 'login';
    if (path.endsWith('/register.html')) return 'register';
    if (path.endsWith('/manage.html')) return 'manage';
    return 'home';
  }

  function renderPublicBottomNav(isAuthed, activePage) {
    if (isAuthed) {
      return `
        <a href="${getRelativePath('dashboard/home.html')}" class="sk-bottom-nav-item ${activePage === 'dashboard' ? 'active' : ''}">
          <i class="bi bi-speedometer2"></i><span>Dashboard</span>
        </a>
        <button onclick="SKLayout.logout()" class="sk-bottom-nav-item danger">
          <i class="bi bi-box-arrow-right"></i><span>Logout</span>
        </button>
      `;
    }

    return `
      <a href="${getRelativePath('index.html')}" class="sk-bottom-nav-item ${activePage === 'home' ? 'active' : ''}">
        <i class="bi bi-house"></i><span>Home</span>
      </a>
      <a href="${getRelativePath('about.html')}" class="sk-bottom-nav-item ${activePage === 'about' ? 'active' : ''}">
        <i class="bi bi-info-circle"></i><span>About</span>
      </a>
      <a href="${getRelativePath('broadcast/manage.html')}" class="sk-bottom-nav-item ${activePage === 'manage' ? 'active' : ''}">
        <i class="bi bi-bell-fill"></i><span>Manage Subscriptions</span>
      </a>
      <a href="${getRelativePath('auth/login.html')}" class="sk-bottom-nav-item ${activePage === 'login' ? 'active' : ''}">
        <i class="bi bi-box-arrow-in-right"></i><span>Login</span>
      </a>
      <a href="${getRelativePath('auth/register.html')}" class="sk-bottom-nav-item ${activePage === 'register' ? 'active' : ''}">
        <i class="bi bi-person-plus"></i><span>Sign Up</span>
      </a>
    `;
  }

  function renderOfflineStaticNav(activePage, options) {
    options = options || {};
    const sidebarNav = document.querySelector('.sk-sidebar-nav');
    const sidebarFooter = document.querySelector('.sk-sidebar-footer');
    const mobileNav = document.querySelector('.sk-bottom-nav-items');
    renderGuestNav(sidebarNav, sidebarFooter, mobileNav, activePage || getPublicPage(), {
      hideAuth: options.hideAuth !== false,
      hideDynamic: true
    });
    if (window.SKTheme && SKTheme.updateToggleUI) {
      SKTheme.updateToggleUI();
    }
  }

  async function setupPublicNav(page) {
    const token = localStorage.getItem('access_token');
    const mobileNav = document.querySelector('.sk-bottom-nav-items');
    const activePage = page || _currentPage || getPublicPage();
    _lastPublicPage = activePage;
    bindBackendRestoreHandler();

    // 1. Inject Sidebar HTML if not present (Unconditional for all pages now)
    if (!document.querySelector('.sk-sidebar')) {
      const logoPath = getRelativePath('static/images/nav-logo.png');
      const sidebarHtml = `
        <aside class="sk-sidebar">
          <div class="sk-sidebar-logo">
            <img src="${logoPath}" alt="Sir Kothay">
          </div>
          <nav class="sk-sidebar-nav"></nav>
          <div class="sk-sidebar-footer"></div>
        </aside>
        <div class="sk-sidebar-overlay"></div>
      `;
      // Insert after the opening <body> or <div class="sk-app"> tag
      const appContainer = document.querySelector('.sk-app') || document.body;
      appContainer.insertAdjacentHTML('afterbegin', sidebarHtml);

      const overlay = document.querySelector('.sk-sidebar-overlay');
      if (overlay) overlay.addEventListener('click', closeSidebar);
    }

    renderNavSkeleton({ includeAccount: !!token });

    const backendState = await resolveBackendState('public-nav-init');
    const backendOffline = backendState !== 'online';

    const sidebarNav = document.querySelector('.sk-sidebar-nav');
    const sidebarFooter = document.querySelector('.sk-sidebar-footer');

    if (backendOffline) {
      renderOfflineStaticNav(activePage, { hideAuth: true });
      waitForBackendRestore();
      return;
    }

    if (token) {
      // --- AUTHENTICATED ---
      try {
        const user = await loadUser();
        if (!user) {
          if (_lastUserLoadError === 'auth') throw new Error('Invalid token');
          markBackendUnavailable('public-nav');
          renderOfflineStaticNav(activePage, { hideAuth: true });
          waitForBackendRestore();
          return;
        }
        
        // --- VERIFICATION GATE ---
        if (user.is_email_verified === false) {
          if (!window.location.href.includes('verify-email.html')) {
            window.location.href = getRelativePath('auth/verify-email.html');
          }
          return;
        }
        
        const details = await loadUserDetails();
        const role = user.role || '';
        const isStaff = user.is_staff || false;
        const links = getSidebarLinks(role, isStaff);

        if (sidebarNav) {
          sidebarNav.innerHTML = renderSidebar(links, activePage) + renderSiteSidebar(role, isStaff, activePage);
        }

        if (sidebarFooter) {
          sidebarFooter.innerHTML = renderAccountFooter(user, details, role, { activePage: activePage });
        }

        if (mobileNav) {
          mobileNav.innerHTML = renderBottomNav(links, '');
        }
      } catch (e) {
        console.error('Failed to set up authed public nav:', e);
        renderGuestNav(sidebarNav, sidebarFooter, mobileNav, activePage, {
          hideAuth: backendOffline,
          hideDynamic: backendOffline
        });
        if (backendOffline) waitForBackendRestore();
      }
    } else {
      // --- GUEST (UNAUTHENTICATED) ---
      renderGuestNav(sidebarNav, sidebarFooter, mobileNav, activePage, {
        hideAuth: backendOffline,
        hideDynamic: backendOffline
      });
      if (backendOffline) waitForBackendRestore();
    }

    // Escape key to close sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _sidebarOpen) closeSidebar();
    });

    if (window.SKTheme && SKTheme.updateToggleUI) {
      SKTheme.updateToggleUI();
    }
  }

  function renderGuestNav(sidebarNav, sidebarFooter, mobileNav, activePage, options) {
    options = options || {};
    const hideAuth = !!options.hideAuth;
    const hideDynamic = options.hideDynamic !== false;
    const authLinks = hideAuth ? '' : `
        <div style="height: 1px; background: var(--sk-border); margin: var(--sk-space-4) 0"></div>
        <a href="${getRelativePath('auth/login.html')}" class="sk-sidebar-link ${activePage === 'login' ? 'active' : ''}">
          <i class="bi bi-box-arrow-in-right"></i><span>Login</span>
        </a>
        <a href="${getRelativePath('auth/register.html')}" class="sk-sidebar-link ${activePage === 'register' ? 'active' : ''}">
          <i class="bi bi-person-plus"></i><span>Sign Up</span>
        </a>
      `;
    const manageLink = hideDynamic ? '' : `
        <a href="${getRelativePath('broadcast/manage.html')}" class="sk-sidebar-link ${activePage === 'manage' ? 'active' : ''}">
          <i class="bi bi-bell-fill"></i><span>Manage Subscriptions</span>
        </a>
      `;
    if (sidebarNav) {
      sidebarNav.innerHTML = `
        <a href="${getRelativePath('index.html')}" class="sk-sidebar-link ${activePage === 'home' ? 'active' : ''}">
          <i class="bi bi-house"></i><span>Home</span>
        </a>
        <a href="${getRelativePath('about.html')}" class="sk-sidebar-link ${activePage === 'about' ? 'active' : ''}">
          <i class="bi bi-info-circle"></i><span>About</span>
        </a>
        ${manageLink}
        <a href="https://github.com/UIU-Developers-Hub/Sir-Kothay" target="_blank" class="sk-sidebar-link">
          <i class="bi bi-github"></i><span>GitHub</span>
        </a>
        ${authLinks}
      `;
    }

    if (sidebarFooter) {
      sidebarFooter.innerHTML = renderThemeGroup();
    }

    if (mobileNav) {
      const mobileAuthItem = hideAuth
        ? `<a href="https://github.com/UIU-Developers-Hub/Sir-Kothay" target="_blank" rel="noopener" class="sk-bottom-nav-item">
          <i class="bi bi-github"></i><span>GitHub</span>
        </a>`
        : `<a href="${getRelativePath('auth/login.html')}" class="sk-bottom-nav-item ${activePage === 'login' ? 'active' : ''}">
          <i class="bi bi-box-arrow-in-right"></i><span>Login</span>
        </a>`;
      mobileNav.innerHTML = `
        <button id="menuToggle" class="sk-bottom-nav-item sk-bottom-nav-menu" onclick="SKLayout.toggleSidebar()">
          <i class="bi bi-list"></i><span>Menu</span>
        </button>
        <a href="${getRelativePath('index.html')}" class="sk-bottom-nav-item ${activePage === 'home' ? 'active' : ''}">
          <i class="bi bi-house"></i><span>Home</span>
        </a>
        <a href="${getRelativePath('about.html')}" class="sk-bottom-nav-item ${activePage === 'about' ? 'active' : ''}">
          <i class="bi bi-info-circle"></i><span>About</span>
        </a>
        ${mobileAuthItem}
      `;
    }
  }

  function loadFooterContributors() {
    const grid = document.getElementById('footerContributors');
    if (!grid) return;
    const url = window.sirKothayContributorsApiUrl ? window.sirKothayContributorsApiUrl() : 
      `https://api.github.com/repos/UIU-Developers-Hub/Sir-Kothay/contributors`;
    fetch(url)
      .then(r => r.json())
      .then(contributors => {
        if (!Array.isArray(contributors)) return;
        grid.innerHTML = contributors.slice(0, 6).map(c => `
          <a href="${c.html_url}" target="_blank" rel="noopener" title="${SKUtils.escapeHtml(c.login)}" 
             style="display:inline-block;width:28px;height:28px;border-radius:50%;overflow:hidden;border:1.5px solid var(--sk-border);transition:transform 0.15s">
            <img src="${c.avatar_url}" alt="${SKUtils.escapeHtml(c.login)}" style="width:100%;height:100%;object-fit:cover">
          </a>
        `).join('');
      })
      .catch(() => {});
  }

  return {
    init,
    checkAuth,
    logout,
    loadUser,
    loadUserDetails,
    getUser,
    getUserDetails,
    clearUserCache,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    getRelativePath,
    setupPublicNav,
    retryBackend,
    renderOfflineStaticNav,
    setNavBadge,
    loadFooterContributors
  };
})();
