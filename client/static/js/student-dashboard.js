let currentUser = null;

function showNotifyModal(msg, variant) {
    if (typeof skNotify !== 'undefined') {
        skNotify(msg, { variant: variant });
    } else {
        alert(msg);
    }
}

function updateStudentShellActive(tab) {
    var map = {
        faculties: { page: 'faculties', title: 'My Faculties' },
        messages: { page: 'messages', title: 'Messages' },
        feed: { page: 'feed', title: 'Updates' },
        settings: { page: 'settings', title: 'Settings' }
    };
    var meta = map[tab] || { page: 'dashboard', title: 'Student Dashboard' };
    document.querySelectorAll('.sk-sidebar-link.active, .sk-bottom-nav-item.active').forEach(function (el) {
        el.classList.remove('active');
    });
    document.querySelectorAll('[data-page="' + meta.page + '"]').forEach(function (el) {
        el.classList.add('active');
    });
    var title = document.querySelector('.sk-topbar-title');
    if (title) title.textContent = meta.title;
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }
    
    // Setup tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active', 'text-gray-800'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.add('text-gray-500'));
            e.currentTarget.classList.remove('text-gray-500');
            e.currentTarget.classList.add('active', 'text-gray-800');
            
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-${e.currentTarget.dataset.tab}`).classList.remove('hidden');

            // Lazy-load tab data
            var tab = e.currentTarget.dataset.tab;
            updateStudentShellActive(tab);
            // Update URL to reflect active tab
            var url = new URL(window.location);
            url.searchParams.set('tab', tab);
            history.replaceState(null, '', url);
            if (tab === 'messages') loadChatThreads();
            if (tab === 'settings') loadStudentSettings();
        });
    });

    await loadStudentData();
    await loadInterests();

    // Handle URL params (e.g. ?tab=messages&thread=5)
    var params = new URLSearchParams(window.location.search);
    var tabParam = params.get('tab');
    var threadParam = params.get('thread');
    if (tabParam) {
        var tabBtn = document.querySelector('[data-tab="' + tabParam + '"]');
        if (tabBtn) tabBtn.click();
        if (threadParam && tabParam === 'messages') {
            setTimeout(function () { stuOpenThread(parseInt(threadParam)); }, 500);
        }
    } else {
        updateStudentShellActive('faculties');
    }
});

async function loadStudentData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/users/me/`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = '../auth/login.html';
            }
            throw new Error('Failed to load profile');
        }
        
        currentUser = await response.json();
        
        document.getElementById('userName').textContent = currentUser.username || 'Student';
        document.getElementById('userEmail').textContent = currentUser.email || '';
        document.getElementById('studentIdDisplay').textContent = `ID: ${currentUser.student_id || 'N/A'}`;
        
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');

        // Load notification settings into toggles
        loadStudentSettings();

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
    } catch (error) {
        console.error('Error loading student data:', error);
        showNotifyModal('Error loading profile', 'error');
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
    feedHidden = true;
    document.getElementById('feedList').innerHTML = '<div class="sk-empty-state compact"><div class="sk-empty-icon"><i class="bi bi-check-circle"></i></div><h3>All caught up</h3></div>';
    document.getElementById('updateCounter').textContent = '0';
    document.getElementById('updateCounter').classList.replace('bg-orange-100', 'bg-gray-100');
    document.getElementById('updateCounter').classList.replace('text-orange-600', 'text-gray-500');
}

async function loadInterests() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/student-interests/`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load faculties');
        
        const interests = await response.json();
        allInterests = interests;
        
        
        // Update stats
        document.getElementById('statAvailableFaculties').textContent = interests.filter(i => i.faculty_details && i.faculty_details.is_available).length;
        
        filterFaculties();
        renderFeed(interests);
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
        
        return `
            <div class="sk-faculty-card">
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
                    <button onclick="initiateNewChat(${interest.faculty}, '${escapedSlug}', '${escapedName}')" class="sk-btn sk-btn-primary sk-btn-sm" style="flex:1">
                        <i class="bi bi-chat-text"></i> Chat
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
                <button onclick="initiateNewChat(${interest.faculty}, '${inlineSlug}', '${inlineName}')" class="sk-btn sk-btn-primary"><i class="bi bi-chat-text"></i> Chat</button>
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

function renderFeed(interests) {
    if (feedHidden) return;
    const list = document.getElementById('feedList');
    
    const feedItems = interests.filter(i => i.faculty_details && (i.faculty_details.is_available || i.faculty_details.active_message));
    
    document.getElementById('updateCounter').textContent = feedItems.length;
    
    if (!feedItems.length) {
        list.innerHTML = '<div class="sk-empty-state compact"><div class="sk-empty-icon"><i class="bi bi-inbox"></i></div><h3>No recent updates</h3></div>';
        document.getElementById('updateCounter').classList.replace('bg-orange-100', 'bg-gray-100');
        document.getElementById('updateCounter').classList.replace('text-orange-600', 'text-gray-500');
        return;
    }
    
    document.getElementById('updateCounter').classList.replace('bg-gray-100', 'bg-orange-100');
    document.getElementById('updateCounter').classList.replace('text-gray-500', 'text-orange-600');
    
    list.innerHTML = feedItems.map(interest => {
        const fac = interest.faculty_details;
        const rawName = fac.username || interest.faculty_username || 'Faculty';
        const inlineName = inlineJsString(rawName);
        const inlineSlug = inlineJsString(fac.slug || '');
        const statusMsg = fac.is_available ? '<span class="sk-feed-state available">is now Available</span>' : '<span class="sk-feed-state unavailable">is Unavailable</span>';
        return `
            <div class="sk-feed-item">
                <div class="sk-feed-avatar">
                    <img src="${resolveProfileImage(fac.profile_image_url)}" alt="${escapeHtml(rawName)}">
                    <span class="sk-presence-dot ${fac.is_available ? 'available' : ''}"></span>
                </div>
                <div class="sk-feed-body">
                    <p class="sk-feed-title"><strong>${escapeHtml(rawName)}</strong> ${statusMsg}</p>
                    ${fac.active_message ? `<p class="sk-feed-status">"${escapeHtml(fac.active_message)}"</p>` : ''}
                    <p class="sk-feed-time"><i class="bi bi-clock"></i> Just updated</p>
                </div>
                <button onclick="initiateNewChat(${interest.faculty}, '${inlineSlug}', '${inlineName}')" class="sk-btn sk-btn-ghost sk-btn-icon" aria-label="Start chat"><i class="bi bi-chat-text"></i></button>
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
        loadInterests();
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
