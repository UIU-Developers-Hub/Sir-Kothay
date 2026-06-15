let currentUser = null;
let studentDashboardLiveTimer = null;
let studentDashboardLiveInFlight = false;
const studentTabLoaded = {};
const STUDENT_DASHBOARD_LIVE_INTERVAL_MS = 10000;

function updateStudentSummaryProfile(details) {
    var image = document.getElementById('userImage');
    if (!image) return;

    var imagePath = (details && (details.profile_image_url || details.profile_image)) ||
        (currentUser && (currentUser.profile_image_url || currentUser.profile_image)) ||
        '';
    var fallback = '../static/images/image.png';
    image.alt = (currentUser && (currentUser.username || currentUser.email)) || 'User';
    image.onerror = function () {
        image.onerror = null;
        image.src = fallback;
    };
    image.src = resolveProfileImage(imagePath, fallback);
}

function updateStudentAvailableCount(count) {
    var el = document.getElementById('statAvailableFaculties');
    if (!el) return;
    var safeCount = parseInt(count, 10);
    el.textContent = Number.isFinite(safeCount) ? String(safeCount) : '0';
}

async function refreshStudentAvailableCount() {
    try {
        var res = await apiRequest(API_ENDPOINTS.STUDENT_AVAILABLE_COUNT);
        if (!res.ok) throw new Error('Failed to load available count');
        var data = await res.json();
        updateStudentAvailableCount(data.available_count);
        return data.available_count;
    } catch (e) {
        console.warn('Student available count unavailable:', e);
        return null;
    }
}

function showNotifyModal(msg, variant) {
    if (typeof skNotify !== 'undefined') {
        skNotify(msg, { variant: variant });
    } else {
        alert(msg);
    }
}

function showStudentBackendUnavailable(message, markOffline) {
    if (markOffline !== false && window.SKBackendStatus && SKBackendStatus.markOffline) {
        SKBackendStatus.markOffline({ reason: 'student-load' });
    }
    if (window.SKLayout && SKLayout.renderOfflineStaticNav) {
        SKLayout.renderOfflineStaticNav('home', { hideAuth: true });
    }
    var main = document.getElementById('mainContent');
    if (main) main.classList.add('hidden');
    var loading = document.getElementById('loadingState');
    if (loading) {
        loading.classList.remove('hidden');
        loading.innerHTML = '<div class="sk-empty-state compact"><div class="sk-empty-icon"><i class="bi bi-wifi-off"></i></div><div class="sk-empty-title">Backend unavailable</div><div class="sk-empty-subtitle">' + escapeHtml(message || 'You are still signed in. Sir Kothay will reconnect automatically.') + '</div><button type="button" class="sk-btn sk-btn-primary sk-btn-sm" onclick="SKLayout.retryBackend()"><i class="bi bi-arrow-clockwise"></i> Retry</button></div>';
    }
}

function updateStudentShellActive(tab) {
    var map = {
        faculties: { page: 'faculties', title: 'My Faculties' },
        messages: { page: 'messages', title: 'Messages' },
        feed: { page: 'feed', title: 'Updates' },
        settings: { page: 'settings', title: 'Settings' },
        profile: { page: 'profile', title: 'Profile' }
    };
    var meta = map[tab] || { page: 'dashboard', title: 'Student Dashboard' };
    document.querySelectorAll('.sk-sidebar-link.active, .sk-bottom-nav-item.active, .sk-sidebar-profile-button.active, .sk-sidebar-settings-button.active').forEach(function (el) {
        el.classList.remove('active');
    });
    document.querySelectorAll('[data-page="' + meta.page + '"]').forEach(function (el) {
        el.classList.add('active');
    });
    var title = document.querySelector('.sk-topbar-title');
    if (title) title.textContent = meta.title;
}

function getActiveStudentTab() {
    var active = document.querySelector('.tab-btn.active');
    return active ? active.dataset.tab : 'faculties';
}

function setStudentTabVisual(tab) {
    var validTabs = ['faculties', 'messages', 'feed', 'settings', 'profile'];
    if (validTabs.indexOf(tab) === -1) tab = 'faculties';

    document.querySelectorAll('.tab-btn').forEach(function (button) {
        var active = button.dataset.tab === tab;
        button.classList.toggle('active', active);
        button.classList.toggle('text-gray-800', active);
        button.classList.toggle('text-gray-500', !active);
    });
    document.querySelectorAll('.tab-content').forEach(function (content) {
        content.classList.toggle('hidden', content.id !== 'tab-' + tab);
    });
    updateStudentShellActive(tab);
    return tab;
}

function renderStudentTabSkeleton(tab) {
    if (tab === 'faculties') {
        var facultiesList = document.getElementById('facultiesList');
        if (facultiesList) {
            facultiesList.innerHTML = [1, 2, 3].map(function () {
                return '<div class="sk-card"><div class="sk-skeleton-row"><span class="sk-skeleton sk-skeleton-avatar"></span><div style="flex:1;min-width:0"><div class="sk-skeleton sk-skeleton-text w-2/3"></div><div class="sk-skeleton sk-skeleton-text w-1/2"></div></div></div><div class="sk-skeleton sk-skeleton-btn" style="width:100%;margin-top:0.75rem"></div></div>';
            }).join('');
        }
    } else if (tab === 'feed') {
        var feedList = document.getElementById('feedList');
        if (feedList) {
            feedList.innerHTML = [1, 2, 3].map(function () {
                return '<div class="sk-skeleton-row" style="padding:0.875rem"><span class="sk-skeleton sk-skeleton-avatar"></span><div style="flex:1;min-width:0"><div class="sk-skeleton sk-skeleton-text w-3/4"></div><div class="sk-skeleton sk-skeleton-text w-1/2"></div></div></div>';
            }).join('');
        }
    } else if (tab === 'messages') {
        var convoList = document.getElementById('stuConvoList');
        if (convoList) {
            convoList.innerHTML = [1, 2, 3, 4].map(function () {
                return '<div class="sk-skeleton-row" style="padding:0.75rem"><span class="sk-skeleton sk-skeleton-avatar"></span><div style="flex:1;min-width:0"><div class="sk-skeleton sk-skeleton-text w-2/3"></div><div class="sk-skeleton sk-skeleton-text w-1/2"></div></div></div>';
            }).join('');
        }
    } else if (tab === 'settings') {
        var settingsTab = document.getElementById('tab-settings');
        if (settingsTab && !settingsTab.querySelector('[data-tab-load-skeleton]')) {
            settingsTab.insertAdjacentHTML('afterbegin', '<div data-tab-load-skeleton class="sk-skeleton-row" style="padding:0 0 1rem"><span class="sk-skeleton sk-skeleton-avatar"></span><div style="flex:1;min-width:0"><div class="sk-skeleton sk-skeleton-text w-1/2"></div><div class="sk-skeleton sk-skeleton-text w-1/3"></div></div></div>');
        }
    } else if (tab === 'profile') {
        var profileTab = document.getElementById('tab-profile');
        if (profileTab && !profileTab.querySelector('[data-tab-load-skeleton]')) {
            profileTab.innerHTML = '<div data-tab-load-skeleton class="sk-profile-panel"><div class="sk-skeleton sk-skeleton-heading"></div><div class="sk-skeleton sk-skeleton-card" style="height:180px;margin-bottom:1.5rem"></div><div class="sk-profile-grid"><div class="sk-skeleton sk-skeleton-card" style="height:280px"></div><div class="sk-skeleton sk-skeleton-card" style="height:280px"></div></div></div>';
        }
    }
}

function clearStudentTabSkeleton(tab) {
    var root = document.getElementById('tab-' + tab);
    if (!root) return;
    root.querySelectorAll('[data-tab-load-skeleton]').forEach(function (el) { el.remove(); });
}

function clearStudentTabContent(tab) {
    clearStudentTabSkeleton(tab);
    if (tab === 'faculties') {
        allInterests = [];
        var facultiesList = document.getElementById('facultiesList');
        if (facultiesList) facultiesList.innerHTML = '';
        var facultiesCount = document.getElementById('facultiesCount');
        if (facultiesCount) facultiesCount.textContent = '0';
    } else if (tab === 'feed') {
        currentFeedActivities = [];
        var feedList = document.getElementById('feedList');
        if (feedList) feedList.innerHTML = '';
    } else if (tab === 'messages') {
        if (typeof clearStudentChatThreads === 'function') clearStudentChatThreads();
    } else if (tab === 'profile') {
        if (window.SKDashboardProfile && SKDashboardProfile.unmount) SKDashboardProfile.unmount();
    }
    delete studentTabLoaded[tab];
}

async function loadStudentTabContent(tab, options) {
    options = options || {};
    if (options.skipRefresh === true) return tab;
    var showSkeleton = !options.silent && !studentTabLoaded[tab];
    if (showSkeleton) renderStudentTabSkeleton(tab);

    if (tab === 'messages') {
        if (typeof loadChatThreads === 'function') await loadChatThreads({ silent: !!options.silent });
        studentTabLoaded.messages = true;
        if (typeof startStudentChatLive === 'function') startStudentChatLive();
    } else {
        if (typeof stopStudentChatLive === 'function') stopStudentChatLive();
        if (tab !== 'profile' && window.SKDashboardProfile) SKDashboardProfile.deactivate();
        if (tab === 'faculties') {
            await loadInterests();
            studentTabLoaded.faculties = true;
            setTimeout(focusStudentDashboardDeepLink, 120);
        } else if (tab === 'feed') {
            await loadFeed();
            studentTabLoaded.feed = true;
        } else if (tab === 'settings') {
            await loadStudentSettings();
            clearStudentTabSkeleton('settings');
            studentTabLoaded.settings = true;
        } else if (tab === 'profile' && window.SKDashboardProfile) {
            await SKDashboardProfile.mount(document.getElementById('tab-profile'), { defaultTab: 'faculties', silent: !!options.silent });
            studentTabLoaded.profile = true;
        }
    }

    if (getActiveStudentTab() !== tab) {
        clearStudentTabContent(tab);
        return tab;
    }

    if (tab === 'feed' && currentFeedActivities.length) renderFeed(currentFeedActivities);
    return tab;
}

async function activateStudentTab(tab, options) {
    options = options || {};
    var previousTab = getActiveStudentTab();
    if (previousTab && previousTab !== tab && options.clearPrevious !== false) {
        clearStudentTabContent(previousTab);
    }
    tab = setStudentTabVisual(tab);

    if (options.updateUrl !== false) {
        var url = new URL(window.location);
        url.searchParams.set('tab', tab);
        history.replaceState(null, '', url);
    }

    if (options.loadData === false) return tab;

    return loadStudentTabContent(tab, options);
}

function showStudentDashboardShell() {
    var loading = document.getElementById('loadingState');
    if (loading) loading.classList.add('hidden');
    var main = document.getElementById('mainContent');
    if (main) main.classList.remove('hidden');
}

function isStudentSettingsEditing() {
    var settingsTab = document.getElementById('tab-settings');
    return !!settingsTab && settingsTab.contains(document.activeElement);
}

async function refreshStudentDashboardLive() {
    if (document.visibilityState === 'hidden') return;
    if (window.SKBackendStatus && window.SKBackendStatus.getState && window.SKBackendStatus.getState() === 'offline') return;

    var tab = getActiveStudentTab();
    if (tab === 'messages') {
        if (typeof loadChatThreads === 'function') await loadChatThreads({ silent: true });
    } else if (typeof refreshStudentChatBadge === 'function') {
        await refreshStudentChatBadge();
    }

    if (tab === 'feed') {
        await loadFeed();
    } else {
        await refreshStudentFeedBadge();
    }

    if (tab === 'faculties') {
        await loadInterests();
    } else {
        await refreshStudentAvailableCount();
    }

    if (tab === 'settings' && !isStudentSettingsEditing()) {
        await loadStudentSettings();
    } else if (tab === 'profile' && window.SKDashboardProfile) {
        await SKDashboardProfile.refreshIfIdle();
    }
}

function scheduleStudentDashboardLive() {
    if (studentDashboardLiveTimer) window.clearTimeout(studentDashboardLiveTimer);
    if (document.visibilityState === 'hidden') return;
    studentDashboardLiveTimer = window.setTimeout(studentDashboardLiveTick, STUDENT_DASHBOARD_LIVE_INTERVAL_MS);
}

async function studentDashboardLiveTick() {
    if (studentDashboardLiveInFlight) {
        scheduleStudentDashboardLive();
        return;
    }
    studentDashboardLiveInFlight = true;
    try {
        await refreshStudentDashboardLive();
    } catch (e) {
        // Global backend status handles connection failures.
    } finally {
        studentDashboardLiveInFlight = false;
        scheduleStudentDashboardLive();
    }
}

function startStudentDashboardLive() {
    scheduleStudentDashboardLive();
}

function stopStudentDashboardLive() {
    if (studentDashboardLiveTimer) window.clearTimeout(studentDashboardLiveTimer);
    studentDashboardLiveTimer = null;
}

let studentReconnectRefreshInFlight = false;
async function refreshStudentDashboardAfterReconnect() {
    if (studentReconnectRefreshInFlight) return;
    studentReconnectRefreshInFlight = true;
    try {
        const activeTab = getActiveStudentTab();
        const loaded = await loadStudentData();
        if (!loaded) return;
        await activateStudentTab(activeTab, { updateUrl: false, silent: true, clearPrevious: false });
        if (activeTab === 'faculties') setTimeout(focusStudentDashboardDeepLink, 120);
        startStudentDashboardLive();
    } finally {
        studentReconnectRefreshInFlight = false;
    }
}

window.addEventListener('sk:backend-restored', function () {
    refreshStudentDashboardAfterReconnect();
});

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }

    readStudentDashboardDeepLink();
    var params = new URLSearchParams(window.location.search);
    var tabParam = params.get('tab');
    var threadParam = params.get('thread');
    var initialTab = getDeepLinkedFacultyId() && tabParam !== 'messages'
        ? 'faculties'
        : (tabParam || 'faculties');
    initialTab = await activateStudentTab(initialTab, { updateUrl: false, loadData: false });
    renderStudentTabSkeleton(initialTab);
    showStudentDashboardShell();
    
    // Setup tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            activateStudentTab(e.currentTarget.dataset.tab);
        });
    });

    var studentLoaded = await loadStudentData();
    if (!studentLoaded) return;
    await activateStudentTab(initialTab, { updateUrl: false });
    if (threadParam && initialTab === 'messages') setTimeout(function () { stuOpenThread(parseInt(threadParam)); }, 500);

    setTimeout(focusStudentDashboardDeepLink, 250);
    startStudentDashboardLive();
});

async function loadStudentData() {
    try {
        if (window.SKBackendStatus && SKBackendStatus.getState && SKBackendStatus.getState() === 'unknown' && SKBackendStatus.check) {
            await SKBackendStatus.check('student-dashboard-load');
        }
        if (window.SKBackendStatus && SKBackendStatus.getState && SKBackendStatus.getState() !== 'online') {
            showStudentBackendUnavailable();
            return false;
        }

        const response = await fetch(`${API_BASE_URL}/api/auth/users/me/`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('access_token');
                window.location.href = '../auth/login.html';
                return false;
            }
            showStudentBackendUnavailable('You are still signed in. Retry in a moment.', [502, 503, 504].indexOf(response.status) !== -1);
            return false;
        }
        
        currentUser = await response.json();
        
        document.getElementById('userName').textContent = currentUser.username || 'Student';
        document.getElementById('userEmail').textContent = currentUser.email || '';
        document.getElementById('studentIdDisplay').textContent = `ID: ${currentUser.student_id || 'N/A'}`;

        var userDetails = null;
        try {
            var detailsResponse = await apiRequest(API_ENDPOINTS.USER_DETAILS);
            if (detailsResponse.ok) userDetails = await detailsResponse.json();
        } catch (detailsError) {
            console.warn('Student profile image details unavailable:', detailsError);
        }
        updateStudentSummaryProfile(userDetails);
        await refreshStudentAvailableCount();
        
        showStudentDashboardShell();

        // If user is admin (is_staff), inject Admin Panel link into navbar
        if (currentUser.is_staff) {
            var desktopNav = document.getElementById('desktopNavLinks');
            if (desktopNav) {
                var adminLink = document.createElement('a');
                adminLink.href = 'admin.html';
                adminLink.className = 'text-purple-600 font-semibold';
                adminLink.style.cssText = 'transition: color 0.2s;';
                adminLink.innerHTML = '<i class="bi bi-shield-lock mr-1"></i>Admin';
                desktopNav.insertBefore(adminLink, desktopNav.firstChild);
            }
            var mobileNav = document.getElementById('mobileNavLinks');
            if (mobileNav) {
                var mAdminLink = document.createElement('a');
                mAdminLink.href = 'admin.html';
                mAdminLink.className = 'flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-purple-600 hover:bg-purple-50 transition';
                mAdminLink.innerHTML = '<i class="bi bi-shield-lock-fill text-2xl"></i><span class="text-xs font-medium">Admin</span>';
                mobileNav.insertBefore(mAdminLink, mobileNav.firstChild);
            }
        }

        // Student ID enforcement: block dashboard until student sets ID
        if (!currentUser.student_id) {
            document.getElementById('mainContent').classList.add('hidden');
            document.getElementById('studentIdModal').classList.remove('hidden');
        }
        return true;
    } catch (error) {
        console.error('Error loading student data:', error);
        showStudentBackendUnavailable();
        return false;
    }
}

async function submitStudentId() {
    var input = document.getElementById('studentIdInput');
    var errorEl = document.getElementById('studentIdError');
    var sid = input.value.trim();
    if (!sid) {
        errorEl.textContent = 'Please enter your Student ID.';
        errorEl.classList.remove('hidden');
        return;
    }
    errorEl.classList.add('hidden');
    try {
        var res = await fetch(API_BASE_URL + '/api/dashboard/student/set-student-id/', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ student_id: sid })
        });
        var data = await res.json();
        if (!res.ok) {
            errorEl.textContent = data.error || 'Failed to save Student ID.';
            errorEl.classList.remove('hidden');
            return;
        }
        // Success — update UI and hide modal
        currentUser.student_id = data.student_id;
        document.getElementById('studentIdDisplay').textContent = 'ID: ' + data.student_id;
        document.getElementById('studentIdModal').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        showNotifyModal('Student ID saved successfully!', 'success');
    } catch (e) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.classList.remove('hidden');
    }
}
let feedHidden = false;
let allInterests = [];
let currentFeedActivities = [];
let studentOpenChatByFaculty = {};
let studentDashboardDeepLink = {
    facultyId: null,
    highlight: ''
};

function studentSeenStorageKey(kind) {
    var userId = currentUser && currentUser.id ? currentUser.id : 'guest';
    return 'sk_student_' + kind + '_seen_' + userId;
}

function readStudentSeenList(kind) {
    try {
        var value = JSON.parse(localStorage.getItem(studentSeenStorageKey(kind)) || '[]');
        return Array.isArray(value) ? value.map(String) : [];
    } catch (e) {
        return [];
    }
}

function writeStudentSeenList(kind, values) {
    localStorage.setItem(studentSeenStorageKey(kind), JSON.stringify(Array.from(new Set(values.map(String)))));
}

function setStudentCounterVisual(el, count) {
    if (!el) return;
    el.textContent = count > 99 ? '99+' : String(count);
    el.style.display = count > 0 ? '' : 'none';
    if (count > 0) {
        el.classList.remove('bg-gray-100', 'text-gray-500');
        el.classList.add('bg-orange-100', 'text-orange-600');
    } else {
        el.classList.remove('bg-orange-100', 'text-orange-600');
        el.classList.add('bg-gray-100', 'text-gray-500');
    }
}

function updateStudentFeedBadge(visibleActivities) {
    var visibleIds = (visibleActivities || []).map(function (act) { return String(act.id); });
    var seen = readStudentSeenList('feed');
    var activeFeed = getActiveStudentTab() === 'feed';
    if (activeFeed) {
        seen = seen.concat(visibleIds);
        writeStudentSeenList('feed', seen);
    }
    var seenSet = new Set(seen);
    var unseenCount = activeFeed ? 0 : visibleIds.filter(function (id) { return !seenSet.has(id); }).length;
    setStudentCounterVisual(document.getElementById('updateCounter'), unseenCount);
    if (window.SKLayout && SKLayout.setNavBadge) SKLayout.setNavBadge('feed', unseenCount);
    return unseenCount;
}

function readStudentDashboardDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const rawFacultyId = params.get('faculty') || params.get('faculty_id');
    const facultyId = parseInt(rawFacultyId || '', 10);

    studentDashboardDeepLink = {
        facultyId: Number.isFinite(facultyId) ? facultyId : null,
        highlight: params.get('highlight') || ''
    };
}

function getDeepLinkedFacultyId() {
    return studentDashboardDeepLink.facultyId;
}

function getInterestByFacultyId(facultyId) {
    const id = parseInt(facultyId, 10);
    return allInterests.find(function (interest) {
        return parseInt(interest.faculty, 10) === id;
    });
}

function getOpenChatForFaculty(facultyId) {
    const interest = getInterestByFacultyId(facultyId);
    if (interest && interest.open_chat && interest.open_chat.has_thread) return interest.open_chat;
    var cached = studentOpenChatByFaculty[String(facultyId)];
    return cached && cached.has_thread ? cached : null;
}

function getChatButtonMeta(facultyId) {
    const openChat = getOpenChatForFaculty(facultyId);
    if (openChat) {
        return {
            label: 'Open Chat',
            icon: 'bi-chat-dots',
            title: 'Open existing chat'
        };
    }

    return {
        label: 'New Chat',
        icon: 'bi-chat-text',
        title: 'Start a new chat'
    };
}

function updateFacultyOpenChat(facultyId, chatData) {
    const interest = getInterestByFacultyId(facultyId);
    var normalized = chatData && chatData.has_thread
        ? {
            has_thread: true,
            thread_id: chatData.thread_id || chatData.id || null,
            status: chatData.status || null
        }
        : { has_thread: false, thread_id: null, status: null };

    studentOpenChatByFaculty[String(facultyId)] = normalized;
    if (interest) interest.open_chat = normalized;

    var activeTab = getActiveStudentTab();
    if (activeTab === 'faculties' && allInterests.length) filterFaculties();
    if (activeTab === 'feed' && currentFeedActivities.length) renderFeed(currentFeedActivities);
}

function focusStudentDashboardDeepLink() {
    const facultyId = getDeepLinkedFacultyId();
    if (!facultyId) return;

    const target = document.querySelector('[data-faculty-card-id="' + facultyId + '"]');
    if (!target) return;

    target.classList.add('sk-deep-highlight');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(function () {
        target.classList.remove('sk-deep-highlight');
    }, 7000);
}

function clearFacultyFiltersForDeepLink() {
    if (!getDeepLinkedFacultyId()) return;

    const nameInput = document.getElementById('filterName');
    const availabilitySelect = document.getElementById('filterAvailability');
    if (nameInput) nameInput.value = '';
    if (availabilitySelect) availabilitySelect.value = 'all';
}

function resolveApiMediaUrl(url) {
    if (!url) return '';
    if (/^(https?:|data:)/i.test(url)) return url;
    return API_BASE_URL + (url.charAt(0) === '/' ? url : '/' + url);
}

function inlineJsString(value) {
    return escapeHtml(String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n]+/g, ' '));
}

function getFacultyDisplayStatus(fac) {
    if (!fac) return '';
    return ((fac.active_message || fac.default_status || '') + '').trim();
}

function getInterestBySlug(slug) {
    return allInterests.find(function (interest) {
        return interest.faculty_details && interest.faculty_details.slug === slug;
    });
}

function renderBellMenu(interest, scope) {
    var safeScope = scope || 'card';
    var wrapId = 'bellWrap_' + safeScope + '_' + interest.id;
    var dropId = 'bellDrop_' + safeScope + '_' + interest.id;
    var buttonClass = safeScope === 'modal'
        ? 'sk-btn sk-btn-secondary sk-btn-icon'
        : 'sk-btn sk-btn-secondary sk-btn-sm';
    return `
        <div class="sk-bell-menu" id="${wrapId}">
            <button onclick="event.stopPropagation(); toggleBellDropdown(${interest.id}, '${safeScope}')" class="${buttonClass}" title="${_bellTitle(interest.notify_preference)}" aria-label="${_bellTitle(interest.notify_preference)}">
                <i class="bi ${_bellIcon(interest.notify_preference)}"></i>
            </button>
            <div id="${dropId}" class="sk-bell-dropdown hidden" data-bell-drop>
                <p class="sk-bell-dropdown-label">Notifications</p>
                <button onclick="event.stopPropagation(); setNotifyPref(${interest.id}, 'all')" class="${interest.notify_preference === 'all' ? 'active' : ''}">
                    <i class="bi bi-bell-fill"></i> All updates
                </button>
                <button onclick="event.stopPropagation(); setNotifyPref(${interest.id}, 'available')" class="${interest.notify_preference === 'available' ? 'active' : ''}">
                    <i class="bi bi-bell"></i> When available
                </button>
                <button onclick="event.stopPropagation(); setNotifyPref(${interest.id}, 'none')" class="${interest.notify_preference === 'none' ? 'active' : ''}">
                    <i class="bi bi-bell-slash"></i> Off
                </button>
            </div>
        </div>
    `;
}

function clearFeed() {
    const dismissed = JSON.parse(localStorage.getItem('sk_dismissed_feed_items') || '[]');
    if (typeof currentFeedActivities !== 'undefined') {
        currentFeedActivities.forEach(act => {
            if (!dismissed.includes(act.id)) {
                dismissed.push(act.id);
            }
        });
        localStorage.setItem('sk_dismissed_feed_items', JSON.stringify(dismissed));
    }
    
    document.getElementById('feedList').innerHTML = '<div class="sk-empty-state compact"><div class="sk-empty-icon"><i class="bi bi-check-circle"></i></div><h3>All caught up</h3></div>';
    updateStudentFeedBadge([]);
}

async function loadInterests() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/student-interests/`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load faculties');
        
        const interests = await response.json();
        allInterests = interests;
        studentOpenChatByFaculty = {};
        allInterests.forEach(function (interest) {
            if (interest && interest.open_chat) {
                studentOpenChatByFaculty[String(interest.faculty)] = interest.open_chat;
            }
        });
        
        
        updateStudentAvailableCount(interests.filter(i => i.faculty_details && i.faculty_details.is_available).length);

        if (getActiveStudentTab() !== 'faculties') return interests;
        
        clearFacultyFiltersForDeepLink();
        filterFaculties();
        return interests;
    } catch (error) {
        console.error(error);
        document.getElementById('facultiesList').innerHTML = '<div class="sk-empty-state compact" style="grid-column:1/-1"><div class="sk-empty-icon"><i class="bi bi-exclamation-triangle"></i></div><div class="sk-empty-title">Failed to load faculties</div><div class="sk-empty-subtitle">Please refresh or try again in a moment.</div></div>';
    }
}

function filterFaculties() {
    const nameFilter = document.getElementById('filterName').value.toLowerCase();
    const availFilter = document.getElementById('filterAvailability').value;
    
    let filtered = allInterests.filter(interest => {
        const fac = interest.faculty_details;
        if (!fac) return false;
        
        const nameMatch = (fac.username || interest.faculty_username || '').toLowerCase().includes(nameFilter);
        
        let availMatch = true;
        if (availFilter === 'available') availMatch = fac.is_available;
        if (availFilter === 'unavailable') availMatch = !fac.is_available;
        
        return nameMatch && availMatch;
    });
    
    document.getElementById('facultiesCount').textContent = filtered.length;
    renderFaculties(filtered);
}

function renderFaculties(interests) {
    const list = document.getElementById('facultiesList');
    if (!interests.length) {
        list.innerHTML = `
            <div class="sk-empty-state compact" style="grid-column:1/-1">
                <div class="sk-empty-icon"><i class="bi bi-person-x"></i></div>
                <h3>No faculties found</h3>
                <button onclick="document.getElementById('addFacultyModal').classList.remove('hidden')" class="sk-btn sk-btn-primary sk-btn-sm"><i class="bi bi-person-plus"></i> Find Faculty</button>
            </div>`;
        return;
    }
    
    list.innerHTML = interests.map(interest => {
        const fac = interest.faculty_details;
        if (!fac) return '';
        const isAvail = fac.is_available;
        const displayName = fac.username || interest.faculty_username;
        const escapedName = inlineJsString(displayName);
        const escapedSlug = inlineJsString(fac.slug || '');
        const statusMessage = getFacultyDisplayStatus(fac);
        const chatMeta = getChatButtonMeta(interest.faculty);
        
        return `
            <div class="sk-faculty-card" data-faculty-card-id="${interest.faculty}">
                <div class="sk-faculty-card-top">
                    <button onclick="viewFacultyProfile(${interest.faculty})" class="sk-faculty-person" type="button">
                        <span class="sk-faculty-avatar-wrap">
                            <img src="${resolveProfileImage(fac.profile_image_url)}" class="sk-faculty-avatar" alt="${escapeHtml(displayName)}">
                            <span class="sk-presence-dot ${isAvail ? 'available' : ''}"></span>
                        </span>
                        <span style="min-width:0">
                            <span class="sk-faculty-name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
                            <span class="sk-faculty-meta">${escapeHtml(fac.designation || 'Faculty')} · ${escapeHtml(fac.organization || 'UIU')}</span>
                            ${statusMessage ? `<span class="sk-faculty-status"><i class="bi ${fac.active_message ? 'bi-broadcast-pin' : 'bi-chat-quote'}" style="margin-right:0.25rem"></i>${escapeHtml(statusMessage)}</span>` : ''}
                        </span>
                    </button>
                    <div class="sk-faculty-actions">
                        <button onclick="event.stopPropagation(); shareProfile('${escapedSlug}', '${escapedName}')" class="sk-btn sk-btn-ghost sk-btn-icon" title="Share QR / Link">
                            <i class="bi bi-share"></i>
                        </button>
                        <button onclick="event.stopPropagation(); removeFaculty(${interest.id})" class="sk-btn sk-btn-ghost sk-btn-icon danger" title="Remove">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                </div>
                
                <div class="sk-faculty-footer">
                    <button onclick="initiateNewChat(${interest.faculty}, '${escapedSlug}', '${escapedName}')" class="sk-btn sk-btn-primary sk-btn-sm" style="flex:1" title="${chatMeta.title}">
                        <i class="bi ${chatMeta.icon}"></i> ${chatMeta.label}
                    </button>
                    ${renderBellMenu(interest, 'card')}
                </div>
            </div>
        `;
    }).join('');
}

function viewFacultyProfile(facultyId) {
    const interest = allInterests.find(i => i.faculty === facultyId);
    if (!interest) return;
    const fac = interest.faculty_details;
    
    const isAvail = fac.is_available;
    const statusText = isAvail ? 'Available' : 'Unavailable';
    const rawName = fac.username || interest.faculty_username || 'Faculty';
    const safeName = escapeHtml(rawName);
    const inlineName = inlineJsString(rawName);
    const inlineSlug = inlineJsString(fac.slug || '');
    const statusMessage = getFacultyDisplayStatus(fac);
    const chatMeta = getChatButtonMeta(interest.faculty);
    const publicHref = '../broadcast/message.html?user=' + encodeURIComponent(fac.slug || '');
    const contactRows = [
        fac.user_email ? `<div class="sk-contact-row"><div class="sk-contact-icon"><i class="bi bi-envelope"></i></div><span>${escapeHtml(fac.user_email)}</span></div>` : '',
        fac.phone_number ? `<div class="sk-contact-row"><div class="sk-contact-icon success"><i class="bi bi-telephone"></i></div><span>${escapeHtml(fac.phone_number)}</span></div>` : '',
        fac.bio ? `<div class="sk-contact-row"><div class="sk-contact-icon neutral"><i class="bi bi-person-lines-fill"></i></div><span>${escapeHtml(fac.bio)}</span></div>` : ''
    ].join('');
    
    const content = `
        <div class="sk-faculty-detail">
            <div class="sk-faculty-detail-head">
                <div class="sk-faculty-detail-avatar-wrap">
                    <img src="${resolveProfileImage(fac.profile_image_url)}" class="sk-faculty-detail-avatar" alt="${safeName}">
                    <div class="sk-presence-dot ${isAvail ? 'available' : ''}"></div>
                </div>
                <h2 class="sk-faculty-detail-name">${safeName}</h2>
                <p class="sk-faculty-detail-meta">${escapeHtml(fac.designation || 'Faculty')} at ${escapeHtml(fac.organization || 'UIU')}</p>
                <div class="sk-faculty-detail-status ${isAvail ? 'available' : 'unavailable'}">
                    <span class="sk-availability-dot ${isAvail ? 'sk-pulse-dot' : ''}"></span>
                    ${statusText}
                </div>
            </div>

            ${statusMessage ? `<div class="sk-faculty-quote"><i class="bi ${fac.active_message ? 'bi-broadcast-pin' : 'bi-chat-quote-fill'}"></i>${escapeHtml(statusMessage)}</div>` : ''}

            ${contactRows ? `<div class="sk-contact-list">${contactRows}</div>` : ''}

            <div class="sk-faculty-detail-actions">
                <button onclick="initiateNewChat(${interest.faculty}, '${inlineSlug}', '${inlineName}')" class="sk-btn sk-btn-primary" title="${chatMeta.title}"><i class="bi ${chatMeta.icon}"></i> ${chatMeta.label}</button>
                ${renderBellMenu(interest, 'modal')}
                <a href="${publicHref}" target="_blank" class="sk-btn sk-btn-secondary sk-btn-icon" title="Open Public Profile" aria-label="Open Public Profile">
                    <i class="bi bi-box-arrow-up-right"></i>
                </a>
                <button onclick="shareProfile('${inlineSlug}', '${inlineName}')" class="sk-btn sk-btn-secondary sk-btn-icon" title="Share QR Code" aria-label="Share QR Code">
                    <i class="bi bi-qr-code"></i>
                </button>
            </div>
        </div>
    `;
    
    skModal.open(content, { maxWidth: 'max-w-md' });
}

function shareProfile(slug, name) {
    const fullUrl = new URL('../broadcast/message.html?user=' + encodeURIComponent(slug), window.location.href).href;
    const interest = getInterestBySlug(slug);
    const savedQrUrl = interest && interest.faculty_details ? resolveApiMediaUrl(interest.faculty_details.qr_code_url) : '';
    const generatedQrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(fullUrl);
    const qrUrl = savedQrUrl || generatedQrUrl;
    const safeFullUrl = escapeHtml(fullUrl);
    const inlineFullUrl = inlineJsString(fullUrl);
    const inlineGeneratedQrUrl = inlineJsString(generatedQrUrl);
    
    const content = `
        <div class="sk-share-panel">
            <p>Scan QR to view <strong>${escapeHtml(name)}</strong>'s live profile.</p>
            <img src="${escapeHtml(qrUrl)}" class="sk-share-qr" alt="Share QR" onerror="this.onerror=null;this.src='${inlineGeneratedQrUrl}'">
            <div class="sk-share-url">
                <input type="text" readonly value="${safeFullUrl}" class="sk-input" id="shareUrlInput">
                <button onclick="navigator.clipboard.writeText('${inlineFullUrl}'); showNotifyModal('Link copied!', 'success');" class="sk-btn sk-btn-secondary sk-btn-sm">Copy</button>
            </div>
            <a href="${safeFullUrl}" target="_blank" class="sk-btn sk-btn-primary sk-btn-sm"><i class="bi bi-box-arrow-up-right"></i> Open Profile</a>
        </div>
    `;
    
    skModal.open(content, { title: 'Share Profile', maxWidth: 'max-w-sm' });
}

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return Math.floor(diffInSeconds / 60) + 'm ago';
    if (diffInSeconds < 86400) return Math.floor(diffInSeconds / 3600) + 'h ago';
    return Math.floor(diffInSeconds / 86400) + 'd ago';
}

function dismissFeedItem(id) {
    const dismissed = JSON.parse(localStorage.getItem('sk_dismissed_feed_items') || '[]');
    if (!dismissed.includes(id)) {
        dismissed.push(id);
        localStorage.setItem('sk_dismissed_feed_items', JSON.stringify(dismissed));
    }
    renderFeed(currentFeedActivities);
}

async function fetchFeedActivities() {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/student-interests/feed/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
    });
    if (!response.ok) throw new Error('Failed to load feed');
    return response.json();
}

async function refreshStudentFeedBadge() {
    if (feedHidden) return;
    try {
        const activities = await fetchFeedActivities();
        const dismissed = JSON.parse(localStorage.getItem('sk_dismissed_feed_items') || '[]');
        updateStudentFeedBadge(activities.filter(act => !dismissed.includes(act.id)));
    } catch (error) {
        console.error('Error refreshing feed badge:', error);
    }
}

async function loadFeed(options) {
    options = options || {};
    if (feedHidden) return;
    try {
        const activities = await fetchFeedActivities();
        if (options.badgeOnly || getActiveStudentTab() !== 'feed') {
            const dismissed = JSON.parse(localStorage.getItem('sk_dismissed_feed_items') || '[]');
            updateStudentFeedBadge(activities.filter(act => !dismissed.includes(act.id)));
            return activities;
        }
        currentFeedActivities = activities;
        renderFeed(currentFeedActivities);
    } catch (error) {
        console.error('Error loading feed:', error);
    }
}

function renderFeed(activities) {
    if (feedHidden) return;
    const list = document.getElementById('feedList');
    
    const dismissed = JSON.parse(localStorage.getItem('sk_dismissed_feed_items') || '[]');
    const visibleActivities = activities.filter(act => !dismissed.includes(act.id));
    updateStudentFeedBadge(visibleActivities);
    
    if (!visibleActivities.length) {
        list.innerHTML = '<div class="sk-empty-state compact"><div class="sk-empty-icon"><i class="bi bi-inbox"></i></div><h3>No recent updates</h3></div>';
        return;
    }

    list.innerHTML = visibleActivities.map(act => {
        const rawName = act.faculty_username || 'Faculty';
        const inlineName = inlineJsString(rawName);
        const inlineSlug = inlineJsString(act.slug || '');
        const chatMeta = getChatButtonMeta(act.faculty_id);
        
        // title logic: "Now Available", "Now Unavailable", "New Status"
        let statusMsg = '';
        if (act.title === 'Now Available') {
            statusMsg = '<span class="sk-feed-state available">is now Available</span>';
        } else if (act.title === 'Now Unavailable') {
            statusMsg = '<span class="sk-feed-state unavailable">is Unavailable</span>';
        } else {
            statusMsg = '<span class="sk-feed-state status-update">posted a status update</span>';
        }
        
        return `
            <div class="sk-feed-item" data-feed-faculty-id="${act.faculty_id}">
                <div class="sk-feed-avatar">
                    <img src="${resolveProfileImage(act.profile_image_url)}" alt="${escapeHtml(rawName)}">
                    <span class="sk-presence-dot ${act.is_available ? 'available' : ''}"></span>
                </div>
                <div class="sk-feed-body">
                    <p class="sk-feed-title"><strong>${escapeHtml(rawName)}</strong> ${statusMsg}</p>
                    ${act.details ? `<p class="sk-feed-status">"${escapeHtml(act.details)}"</p>` : ''}
                    <p class="sk-feed-time"><i class="bi bi-clock"></i> ${formatRelativeTime(act.created_at)}</p>
                </div>
                <div style="display:flex; gap:0.25rem;">
                    <button onclick="initiateNewChat(${act.faculty_id}, '${inlineSlug}', '${inlineName}')" class="sk-btn sk-btn-ghost sk-btn-icon" aria-label="${chatMeta.label}" title="${chatMeta.label}"><i class="bi ${chatMeta.icon}"></i></button>
                    <button onclick="dismissFeedItem(${act.id})" class="sk-btn sk-btn-ghost sk-btn-icon" aria-label="Dismiss" title="Dismiss update"><i class="bi bi-x-lg"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

async function searchFaculties() {
    const query = document.getElementById('facultySearch').value.toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    
    if (query.length < 2) {
        resultsDiv.innerHTML = '<p class="sk-search-note">Type at least 2 characters...</p>';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/student-interests/search_faculties/?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (!response.ok) throw new Error('Search failed');
        
        const matched = await response.json();
        
        if (!matched.length) {
            resultsDiv.innerHTML = '<p class="sk-search-note">No faculties found.</p>';
            return;
        }
        
        resultsDiv.innerHTML = matched.map(u => `
            <div class="sk-search-result">
                <div class="sk-search-result-main">
                    <img src="${resolveProfileImage(u.profile_image_url)}" alt="${escapeHtml(u.username)}">
                    <div>
                        <p class="sk-search-result-name">${escapeHtml(u.username)}</p>
                        <p class="sk-search-result-meta">${escapeHtml(u.designation || 'Faculty')}</p>
                    </div>
                </div>
                <button onclick="addFaculty(${u.user})" class="sk-btn sk-btn-primary sk-btn-sm">Add</button>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
        resultsDiv.innerHTML = '<p class="sk-search-error">Search error.</p>';
    }
}

async function addFaculty(facultyId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/student-interests/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ faculty: facultyId })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to add faculty. Maybe already added?');
        }
        
        showNotifyModal('Faculty added to your dashboard!', 'success');
        document.getElementById('addFacultyModal').classList.add('hidden');
        document.getElementById('facultySearch').value = '';
        document.getElementById('searchResults').innerHTML = '';
        loadInterests();
    } catch (error) {
        showNotifyModal(error.message, 'error');
    }
}

async function removeFaculty(interestId) {
    const ok = await skConfirm('Are you sure you want to remove this faculty from your dashboard?', { title: 'Remove Faculty', confirmText: 'Remove', danger: true });
    if (!ok) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/student-interests/${interestId}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to remove');
        
        loadInterests();
        showNotifyModal('Faculty removed.', 'success');
    } catch (error) {
        showNotifyModal(error.message, 'error');
    }
}

// Bell notification dropdown helpers
function _bellIcon(pref) {
    if (pref === 'all') return 'bi-bell-fill';
    if (pref === 'available') return 'bi-bell';
    return 'bi-bell-slash';
}
function _bellBtnClass(pref) {
    if (pref === 'all') return 'bg-blue-50 text-blue-600 border border-blue-200';
    if (pref === 'available') return 'bg-green-50 text-green-600 border border-green-200';
    return 'bg-gray-50 text-gray-400 border border-gray-200 hover:text-orange-500 hover:border-orange-200';
}
function _bellTitle(pref) {
    if (pref === 'all') return 'Notifications: All updates';
    if (pref === 'available') return 'Notifications: When available';
    return 'Notifications: Off';
}

function toggleBellDropdown(interestId, scope) {
    var safeScope = scope || 'card';
    var drop = document.getElementById('bellDrop_' + safeScope + '_' + interestId);
    if (!drop) return;
    var isHidden = drop.classList.contains('hidden');
    // Close all other dropdowns first
    document.querySelectorAll('[data-bell-drop]').forEach(function (d) { d.classList.add('hidden'); });
    if (isHidden) {
        drop.classList.remove('hidden');
        // Close on outside click
        setTimeout(function () {
            document.addEventListener('click', function _closeBell(e) {
                if (!drop.contains(e.target) && !e.target.closest('#bellWrap_' + safeScope + '_' + interestId)) {
                    drop.classList.add('hidden');
                    document.removeEventListener('click', _closeBell);
                }
            });
        }, 10);
    }
}

async function setNotifyPref(interestId, pref) {
    // Close dropdown
    document.querySelectorAll('[data-bell-drop]').forEach(function (d) { d.classList.add('hidden'); });
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/student-interests/${interestId}/`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notify_preference: pref })
        });
        if (!response.ok) throw new Error('Failed to update');
        var labels = { all: 'All updates', available: 'When available', none: 'Off' };
        showNotifyModal('Notifications: ' + labels[pref], 'success');
        if (getActiveStudentTab() === 'faculties') loadInterests();
        else if (getActiveStudentTab() === 'feed') loadFeed();
    } catch (error) {
        showNotifyModal(error.message, 'error');
    }
}

async function loadStudentSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/user-details/my_details/`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        var el1 = document.getElementById('settingNotifyNewChats');
        var el2 = document.getElementById('settingNotifyReplies');
        var el3 = document.getElementById('settingNotifyClosed');
        if (el1) el1.checked = !!data.notify_new_chats;
        if (el2) el2.checked = !!data.notify_chat_replies;
        if (el3) el3.checked = !!data.notify_chat_closed;
    } catch (e) { console.error(e); }
}

async function saveStudentSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/user-details/update_my_details/`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                notify_new_chats: document.getElementById('settingNotifyNewChats').checked,
                notify_chat_replies: document.getElementById('settingNotifyReplies').checked,
                notify_chat_closed: document.getElementById('settingNotifyClosed').checked,
            })
        });
        if (!response.ok) throw new Error('Failed to save');
        showNotifyModal('Settings saved.', 'success');
    } catch (e) {
        showNotifyModal('Failed to save settings.', 'error');
    }
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '../auth/login.html';
}

document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
        startStudentDashboardLive();
        refreshStudentDashboardLive();
    } else {
        stopStudentDashboardLive();
    }
});
