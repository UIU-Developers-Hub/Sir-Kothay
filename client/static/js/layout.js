/* ============================================================
   SIR KOTHAY — Layout Controller
   Sidebar, Topbar, Bottom Nav, Auth guard, User data
   ============================================================ */

window.SKLayout = (() => {
  'use strict';

  let _user = null;
  let _userDetails = null;
  let _sidebarOpen = false;
  let _currentPage = '';

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
    try {
      const res = await apiRequest(API_ENDPOINTS.CURRENT_USER);
      if (res.ok) {
        _user = await res.json();
        return _user;
      }
    } catch (e) {
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

  /* ─────────────────────────────────────────────────────────
     SIDEBAR GENERATION
     ───────────────────────────────────────────────────────── */
  function getSidebarLinks(role, isStaff) {
    const base = window.location.pathname.includes('/dashboard/') ? '' : 'dashboard/';

    const links = [];

    if (role === 'FACULTY') {
      links.push(
        { id: 'broadcast', icon: 'megaphone', label: 'Broadcast', href: `${base}home.html?tab=messages` },
        { id: 'templates', icon: 'lightning', label: 'Quick Status', href: `${base}home.html?tab=templates` },
        { id: 'calendar', icon: 'calendar3', label: 'Calendar', href: `${base}home.html?tab=calendar` },
        { id: 'inbox', icon: 'chat-dots', label: 'Messages', href: `${base}home.html?tab=inbox` }
      );
    } else if (role === 'STUDENT') {
      links.push(
        { id: 'faculties', icon: 'people', label: 'My Faculties', href: `${base}student.html?tab=faculties` },
        { id: 'messages', icon: 'chat-dots', label: 'Messages', href: `${base}student.html?tab=messages` },
        { id: 'feed', icon: 'rss', label: 'Updates', href: `${base}student.html?tab=feed` }
      );
    }

    // Admin goes to its own sidebar section, NOT in bottom nav
    if (isStaff) {
      links.push({ id: 'admin', icon: 'shield-lock', label: 'Admin Panel', href: `${base}admin.html`, section: 'admin' });
    }

    // Bottom section
    links.push(
      { id: 'profile', icon: 'person', label: 'Profile', href: `${base}profile.html`, section: 'bottom' },
      { id: 'settings', icon: 'gear', label: 'Settings', href: role === 'FACULTY' ? `${base}home.html?tab=fc-settings` : `${base}student.html?tab=settings`, section: 'bottom' }
    );

    return links;
  }

  function getSiteLinks(role, isStaff) {
    const links = [
      { id: 'site-home', icon: 'house', label: 'Home', href: getRelativePath('index.html') },
      { id: 'site-about', icon: 'info-circle', label: 'About', href: getRelativePath('about.html') },
      { id: 'site-github', icon: 'github', label: 'GitHub', href: 'https://github.com/UIU-Developers-Hub/Sir-Kothay', external: true }
    ];
    return links;
  }

  function getActiveDashboardPage(page, role) {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.endsWith('/admin.html')) return 'admin';
    if (path.endsWith('/profile.html')) return 'profile';

    const tab = new URLSearchParams(window.location.search).get('tab');
    if (role === 'FACULTY' && path.endsWith('/home.html')) {
      const map = {
        messages: 'broadcast',
        broadcast: 'broadcast',
        templates: 'templates',
        schedules: 'calendar',
        calendar: 'calendar',
        inbox: 'inbox',
        'fc-settings': 'settings'
      };
      return map[tab] || 'broadcast';
    }

    if (role === 'STUDENT' && path.endsWith('/student.html')) {
      const map = {
        faculties: 'faculties',
        messages: 'messages',
        feed: 'feed',
        settings: 'settings'
      };
      return map[tab] || 'faculties';
    }

    return page;
  }

  function renderSidebar(links, activePage) {
    const mainLinks = links.filter(l => !l.section);
    const adminLinks = links.filter(l => l.section === 'admin');
    const bottomLinks = links.filter(l => l.section === 'bottom');

    let navHtml = '<div class="sk-sidebar-desktop-menu"><div class="sk-sidebar-section sk-sidebar-tabs">';
    navHtml += '<div class="sk-sidebar-section-title">Menu</div>';
    mainLinks.forEach(l => {
      const active = l.id === activePage ? 'active' : '';
      const badgeHtml = l.badge ? `<span class="sk-sidebar-badge">${l.badge}</span>` : '';
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

    if (bottomLinks.length) {
      navHtml += '<div class="sk-sidebar-section">';
      navHtml += '<div class="sk-sidebar-section-title">Account</div>';
      bottomLinks.forEach(l => {
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

  function renderSiteSidebar(role, isStaff) {
    const links = getSiteLinks(role, isStaff);
    let html = '<div class="sk-sidebar-site-links"><div class="sk-sidebar-divider"></div><div class="sk-sidebar-section">';
    html += '<div class="sk-sidebar-section-title">Website</div>';
    links.forEach(l => {
      const external = l.external ? ' target="_blank" rel="noopener"' : '';
      html += `<a href="${l.href}" class="sk-sidebar-link" data-page="${l.id}"${external}>
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
      const priority = ['broadcast', 'calendar', 'inbox', 'templates'];
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
      return `<a href="${l.href}" class="sk-bottom-nav-item ${active}" data-page="${l.id}"${action}>
        <i class="bi bi-${l.icon}"></i>
        <span>${SKUtils.escapeHtml(l.label)}</span>
      </a>`;
    }).join('');
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

    // Auth check
    if (requireAuth && !checkAuth()) return;

    // For dashboard layouts, build the shell
    if (type === 'dashboard') {
      await initDashboardLayout(page, onReady);
    } else if (onReady) {
      onReady();
    }
  }

  async function initDashboardLayout(page, onReady) {
    // Load user data
    const user = await loadUser();
    if (!user) {
      logout();
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
      sidebarNav.innerHTML = renderSidebar(links, activePage) + renderSiteSidebar(role, isStaff);
    }

    // Populate sidebar user footer
    const sidebarFooter = document.querySelector('.sk-sidebar-footer');
    if (sidebarFooter) {
      const avatarSrc = details?.profile_image ? resolveProfileImage(details.profile_image) : null;
      const displayName = user.username || user.email;
      sidebarFooter.innerHTML = `
        <div class="sk-sidebar-theme-group" aria-label="Theme">
          <button type="button" data-theme-choice="system" onclick="SKTheme.set('system')">System</button>
          <button type="button" data-theme-choice="light" onclick="SKTheme.set('light')">Light</button>
          <button type="button" data-theme-choice="dark" onclick="SKTheme.set('dark')">Dark</button>
        </div>
        <div class="sk-sidebar-account-row">
          <a href="${getRelativePath('dashboard/profile.html')}" class="sk-sidebar-profile-button">
            ${SKComponents.avatar(avatarSrc, displayName, 'sm')}
            <span>${SKUtils.escapeHtml(displayName)}</span>
          </a>
          <button class="sk-sidebar-signout-button" onclick="SKLayout.logout()" title="Sign out" aria-label="Sign out">
            <i class="bi bi-box-arrow-right"></i>
          </button>
        </div>
      `;
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
    } else if (role === 'STUDENT') {
      tabMap.faculties = 'faculties';
      tabMap.messages  = 'messages';
      tabMap.feed      = 'feed';
      tabMap.settings  = 'settings';
    }

    // Attach click handler to every sidebar and bottom-nav link
    document.querySelectorAll('.sk-sidebar-link[data-page], .sk-bottom-nav-item[data-page]').forEach(el => {
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
          document.querySelectorAll('.sk-sidebar-link.active, .sk-bottom-nav-item.active').forEach(a => a.classList.remove('active'));
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
    return 'home';
  }

  function renderPublicBottomNav(isAuthed, activePage) {
    if (isAuthed) {
      return `
        <a href="${getRelativePath('dashboard/home.html')}" class="sk-bottom-nav-item ${activePage === 'dashboard' ? 'active' : ''}">
          <i class="bi bi-speedometer2"></i><span>Dashboard</span>
        </a>
        <a href="${getRelativePath('dashboard/profile.html')}" class="sk-bottom-nav-item ${activePage === 'profile' ? 'active' : ''}">
          <i class="bi bi-person-circle"></i><span>Profile</span>
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
      <a href="${getRelativePath('auth/login.html')}" class="sk-bottom-nav-item ${activePage === 'login' ? 'active' : ''}">
        <i class="bi bi-box-arrow-in-right"></i><span>Login</span>
      </a>
      <a href="${getRelativePath('auth/register.html')}" class="sk-bottom-nav-item ${activePage === 'register' ? 'active' : ''}">
        <i class="bi bi-person-plus"></i><span>Sign Up</span>
      </a>
    `;
  }

  async function setupPublicNav(page) {
    const token = localStorage.getItem('access_token');
    const mobileNav = document.querySelector('.sk-bottom-nav-items');
    const activePage = page || _currentPage || getPublicPage();

    // 1. Inject Sidebar HTML if not present (Unconditional for all pages now)
    if (!document.querySelector('.sk-sidebar')) {
      const logoPath = getRelativePath('static/images/logo.png');
      const sidebarHtml = `
        <aside class="sk-sidebar">
          <div class="sk-sidebar-logo">
            <img src="${logoPath}" alt="Sir Kothay">
            <span class="sk-sidebar-logo-text">Sir <span>Kothay</span></span>
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

    const sidebarNav = document.querySelector('.sk-sidebar-nav');
    const sidebarFooter = document.querySelector('.sk-sidebar-footer');

    if (token) {
      // --- AUTHENTICATED ---
      try {
        const user = await loadUser();
        if (!user) throw new Error('Invalid token');
        
        const details = await loadUserDetails();
        const role = user.role || '';
        const isStaff = user.is_staff || false;
        const links = getSidebarLinks(role, isStaff);

        if (sidebarNav) {
          sidebarNav.innerHTML = renderSidebar(links, '') + renderSiteSidebar(role, isStaff);
        }

        if (sidebarFooter) {
          const avatarSrc = details?.profile_image ? resolveProfileImage(details.profile_image) : null;
          const displayName = user.username || user.email;
          sidebarFooter.innerHTML = `
            <div class="sk-sidebar-theme-group" aria-label="Theme">
              <button type="button" data-theme-choice="system" onclick="SKTheme.set('system')">System</button>
              <button type="button" data-theme-choice="light" onclick="SKTheme.set('light')">Light</button>
              <button type="button" data-theme-choice="dark" onclick="SKTheme.set('dark')">Dark</button>
            </div>
            <div class="sk-sidebar-account-row">
              <a href="${getRelativePath('dashboard/profile.html')}" class="sk-sidebar-profile-button">
                ${SKComponents.avatar(avatarSrc, displayName, 'sm')}
                <span>${SKUtils.escapeHtml(displayName)}</span>
              </a>
              <button class="sk-sidebar-signout-button" onclick="SKLayout.logout()" title="Sign out" aria-label="Sign out">
                <i class="bi bi-box-arrow-right"></i>
              </button>
            </div>
          `;
        }

        if (mobileNav) {
          mobileNav.innerHTML = renderBottomNav(links, '');
        }
      } catch (e) {
        console.error('Failed to set up authed public nav:', e);
        renderGuestNav(sidebarNav, sidebarFooter, mobileNav, activePage);
      }
    } else {
      // --- GUEST (UNAUTHENTICATED) ---
      renderGuestNav(sidebarNav, sidebarFooter, mobileNav, activePage);
    }

    // Escape key to close sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _sidebarOpen) closeSidebar();
    });

    if (window.SKTheme && SKTheme.updateToggleUI) {
      SKTheme.updateToggleUI();
    }
  }

  function renderGuestNav(sidebarNav, sidebarFooter, mobileNav, activePage) {
    if (sidebarNav) {
      sidebarNav.innerHTML = `
        <a href="${getRelativePath('index.html')}" class="sk-sidebar-link ${activePage === 'home' ? 'active' : ''}">
          <i class="bi bi-house"></i><span>Home</span>
        </a>
        <a href="${getRelativePath('about.html')}" class="sk-sidebar-link ${activePage === 'about' ? 'active' : ''}">
          <i class="bi bi-info-circle"></i><span>About</span>
        </a>
        <a href="https://github.com/UIU-Developers-Hub/Sir-Kothay" target="_blank" class="sk-sidebar-link">
          <i class="bi bi-github"></i><span>GitHub</span>
        </a>
        <div style="height: 1px; background: var(--sk-border); margin: var(--sk-space-4) 0"></div>
        <a href="${getRelativePath('auth/login.html')}" class="sk-sidebar-link ${activePage === 'login' ? 'active' : ''}">
          <i class="bi bi-box-arrow-in-right"></i><span>Login</span>
        </a>
        <a href="${getRelativePath('auth/register.html')}" class="sk-sidebar-link ${activePage === 'register' ? 'active' : ''}">
          <i class="bi bi-person-plus"></i><span>Sign Up</span>
        </a>
      `;
    }

    if (sidebarFooter) {
      sidebarFooter.innerHTML = `
        <div class="sk-sidebar-theme-group" aria-label="Theme">
          <button type="button" data-theme-choice="system" onclick="SKTheme.set('system')">System</button>
          <button type="button" data-theme-choice="light" onclick="SKTheme.set('light')">Light</button>
          <button type="button" data-theme-choice="dark" onclick="SKTheme.set('dark')">Dark</button>
        </div>
      `;
    }

    if (mobileNav) {
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
        <a href="${getRelativePath('auth/login.html')}" class="sk-bottom-nav-item ${activePage === 'login' ? 'active' : ''}">
          <i class="bi bi-box-arrow-in-right"></i><span>Login</span>
        </a>
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
    loadFooterContributors
  };
})();
