let currentUser = null;

function showNotifyModal(msg, variant) {
    if (typeof skNotify !== 'undefined') {
        skNotify(msg, { variant: variant });
    } else {
        alert(msg);
    }
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
    } catch (error) {
        console.error('Error loading student data:', error);
        showNotifyModal('Error loading profile', 'error');
    }
}
let feedHidden = false;
let allInterests = [];

function clearFeed() {
    feedHidden = true;
    document.getElementById('feedList').innerHTML = '<div class="py-12 text-center text-gray-400"><i class="bi bi-check-circle text-4xl mb-3 block text-green-400"></i>All caught up!</div>';
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
        document.getElementById('facultiesList').innerHTML = '<p class="text-red-500">Failed to load faculties.</p>';
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
            <div class="col-span-full py-16 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <i class="bi bi-person-x text-4xl text-gray-400 mb-3 block"></i>
                <h3 class="text-lg font-semibold text-gray-700">No faculties found</h3>
                <p class="text-sm text-gray-500 mt-1">Try adjusting your filters or click 'Find Faculty' to add new ones.</p>
            </div>`;
        return;
    }
    
    list.innerHTML = interests.map(interest => {
        const fac = interest.faculty_details;
        if (!fac) return '';
        const isAvail = fac.is_available;
        const statusColor = isAvail ? 'bg-green-500' : 'bg-red-500';
        
        return `
            <div class="bg-white border border-gray-200 rounded-xl p-3 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative">
                <!-- Action Buttons Overlay (Always Visible) -->
                <div class="absolute top-3 right-3 flex items-center gap-1.5 z-10 bg-white/80 backdrop-blur-sm rounded-lg p-1">
                    <button onclick="event.stopPropagation(); shareProfile('${fac.slug}', '${fac.username || interest.faculty_username}')" class="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded-md transition-colors" title="Share QR / Link">
                        <i class="bi bi-share-fill text-xs"></i>
                    </button>
                    <button onclick="event.stopPropagation(); removeFaculty(${interest.id})" class="w-7 h-7 flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-md transition-colors" title="Remove">
                        <i class="bi bi-trash3 text-xs"></i>
                    </button>
                </div>
            
                <div onclick="viewFacultyProfile(${interest.faculty})" class="flex items-center gap-3 min-w-0 flex-1 hover:bg-gray-50 p-2 -m-2 rounded-lg transition-colors cursor-pointer text-left">
                    <div class="relative flex-shrink-0">
                        <img src="${fac.profile_image_url || '../static/images/image.png'}" class="w-14 h-14 rounded-full object-cover border border-gray-100 shadow-sm hover:border-orange-200 transition-colors">
                        <div class="absolute bottom-0 right-0 w-3.5 h-3.5 ${statusColor} border-2 border-white rounded-full"></div>
                    </div>
                    <div class="min-w-0 pr-12">
                        <h3 class="font-bold text-sm text-gray-900 truncate" title="${fac.username || interest.faculty_username}">${fac.username || interest.faculty_username}</h3>
                        <p class="text-xs text-gray-500 font-medium truncate">${fac.designation || 'Faculty'} • ${fac.organization || 'UIU'}</p>
                        ${fac.default_status ? `<p class="text-[11px] text-gray-500 truncate mt-1 bg-gray-50 inline-block px-2 py-0.5 rounded border border-gray-100"><i class="bi bi-quote text-gray-400"></i> ${fac.default_status}</p>` : ''}
                    </div>
                </div>
                
                <div class="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                    <button onclick="initiateNewChat(${interest.faculty}, '${fac.slug}', '${(fac.username || interest.faculty_username).replace(/'/g, '\\\'')}')" class="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white py-1.5 rounded-lg text-sm font-semibold transition-colors duration-200 flex justify-center items-center gap-2">
                        <i class="bi bi-chat-text"></i> Chat
                    </button>
                    <div class="relative" id="bellWrap_${interest.id}">
                        <button onclick="event.stopPropagation(); toggleBellDropdown(${interest.id})" class="px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 flex items-center gap-1 ${_bellBtnClass(interest.notify_preference)}" title="${_bellTitle(interest.notify_preference)}">
                            <i class="bi ${_bellIcon(interest.notify_preference)}"></i>
                        </button>
                        <div id="bellDrop_${interest.id}" class="hidden absolute right-0 bottom-full mb-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in">
                            <p class="text-[10px] text-gray-400 font-bold px-3 pt-2.5 pb-1 uppercase tracking-wider">Notifications</p>
                            <button onclick="setNotifyPref(${interest.id}, 'all')" class="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-blue-50 transition ${interest.notify_preference === 'all' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600'}">
                                <i class="bi bi-bell-fill text-sm"></i> All updates
                            </button>
                            <button onclick="setNotifyPref(${interest.id}, 'available')" class="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-green-50 transition ${interest.notify_preference === 'available' ? 'bg-green-50 text-green-600 font-bold' : 'text-gray-600'}">
                                <i class="bi bi-bell text-sm"></i> When available
                            </button>
                            <button onclick="setNotifyPref(${interest.id}, 'none')" class="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition ${interest.notify_preference === 'none' ? 'bg-gray-100 text-gray-800 font-bold' : 'text-gray-600'}">
                                <i class="bi bi-bell-slash text-sm"></i> Off
                            </button>
                        </div>
                    </div>
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
    const statusColor = isAvail ? 'bg-green-500' : 'bg-red-500';
    const statusText = isAvail ? 'Available' : 'Unavailable';
    const statusBg = isAvail ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-100';
    
    const content = `
        <div class="text-center mb-6">
            <div class="relative inline-block">
                <img src="${fac.profile_image_url || '../static/images/image.png'}" class="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg mx-auto">
                <div class="absolute bottom-1 right-1 w-5 h-5 ${statusColor} border-4 border-white rounded-full"></div>
            </div>
            <h2 class="text-xl font-bold text-gray-900 mt-3">${fac.username || interest.faculty_username}</h2>
            <p class="text-sm text-gray-500 font-medium">${fac.designation || 'Faculty'} at ${fac.organization || 'UIU'}</p>
            <div class="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${statusBg} text-xs font-bold uppercase tracking-wider">
                <span class="w-2 h-2 rounded-full ${statusColor} ${isAvail ? 'animate-pulse' : ''}"></span>
                ${statusText}
            </div>
        </div>
        
        ${fac.default_status ? `
        <div class="bg-gray-50 rounded-xl p-4 mb-4 text-sm text-gray-700 border border-gray-200 text-center relative">
            <i class="bi bi-chat-quote-fill absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl text-blue-400 bg-white rounded-full px-1"></i>
            <span class="italic font-medium text-gray-600 block mt-2">"${fac.default_status}"</span>
        </div>` : ''}
        
        <div class="space-y-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm mb-6">
            ${fac.user_email ? `<div class="flex items-center gap-3 text-sm"><div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0"><i class="bi bi-envelope"></i></div><span class="text-gray-600">${fac.user_email}</span></div>` : ''}
            ${fac.phone_number ? `<div class="flex items-center gap-3 text-sm"><div class="w-8 h-8 rounded-lg bg-green-50 text-green-500 flex items-center justify-center flex-shrink-0"><i class="bi bi-telephone"></i></div><span class="text-gray-600">${fac.phone_number}</span></div>` : ''}
            ${fac.bio ? `<div class="flex items-start gap-3 text-sm"><div class="w-8 h-8 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center flex-shrink-0"><i class="bi bi-person-lines-fill"></i></div><span class="text-gray-600 flex-1">${fac.bio}</span></div>` : ''}
        </div>
        
        <div class="flex gap-2 mt-4">
            <button onclick="initiateNewChat(${interest.faculty}, '${fac.slug}', '${(fac.username || interest.faculty_username).replace(/'/g, '\\\'')}')" class="flex-1 bg-blue-500 text-white hover:bg-blue-600 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 shadow-md shadow-blue-500/20"><i class="bi bi-chat-text mr-1"></i> Chat</button>
            <a href="../broadcast/message.html?user=${fac.slug}" target="_blank" class="bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 border border-orange-200 hover:border-transparent flex justify-center items-center" title="Open Public Profile">
                <i class="bi bi-box-arrow-up-right"></i>
            </a>
            <button onclick="shareProfile('${fac.slug}', '${fac.username || interest.faculty_username}')" class="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200" title="Share QR Code">
                <i class="bi bi-qr-code"></i>
            </button>
        </div>
    `;
    
    skModal.open(content, { maxWidth: 'max-w-md' });
}

function shareProfile(slug, name) {
    const fullUrl = window.location.origin + '/client/broadcast/message.html?user=' + slug;
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(fullUrl);
    
    const content = `
        <div class="text-center">
            <p class="text-sm text-gray-600 mb-4">Scan QR to view <strong>${name}</strong>'s live profile.</p>
            <img src="${qrUrl}" class="mx-auto border-4 border-white shadow-md rounded-xl w-48 h-48 mb-4">
            <div class="flex items-center gap-2 mt-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
                <input type="text" readonly value="${fullUrl}" class="text-xs bg-transparent border-none flex-1 focus:ring-0 text-gray-600" id="shareUrlInput">
                <button onclick="navigator.clipboard.writeText('${fullUrl}'); showNotifyModal('Link copied!', 'success');" class="bg-white border border-gray-200 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-gray-100 transition shadow-sm text-gray-700">Copy</button>
            </div>
            <a href="${fullUrl}" target="_blank" class="mt-3 inline-block text-blue-600 text-sm hover:underline font-medium">Open Profile <i class="bi bi-box-arrow-up-right text-xs"></i></a>
        </div>
    `;
    
    skModal.open(content, { title: 'Share Profile', maxWidth: 'max-w-sm' });
}

function renderFeed(interests) {
    if (feedHidden) return;
    const list = document.getElementById('feedList');
    
    const feedItems = interests.filter(i => i.faculty_details && (i.faculty_details.is_available || i.faculty_details.default_status));
    
    document.getElementById('updateCounter').textContent = feedItems.length;
    
    if (!feedItems.length) {
        list.innerHTML = '<div class="py-12 text-center text-gray-400"><i class="bi bi-inbox text-4xl mb-3 block"></i>No recent updates.</div>';
        document.getElementById('updateCounter').classList.replace('bg-orange-100', 'bg-gray-100');
        document.getElementById('updateCounter').classList.replace('text-orange-600', 'text-gray-500');
        return;
    }
    
    document.getElementById('updateCounter').classList.replace('bg-gray-100', 'bg-orange-100');
    document.getElementById('updateCounter').classList.replace('text-gray-500', 'text-orange-600');
    
    list.innerHTML = feedItems.map(interest => {
        const fac = interest.faculty_details;
        const statusMsg = fac.is_available ? '<span class="text-green-600 font-semibold">is now Available</span>' : '<span class="text-red-500">is Unavailable</span>';
        return `
            <div class="p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                <div class="relative">
                    <img src="${fac.profile_image_url || '../static/images/image.png'}" class="w-12 h-12 rounded-full object-cover border border-gray-200">
                    <div class="absolute bottom-0 right-0 w-3.5 h-3.5 ${fac.is_available ? 'bg-green-500' : 'bg-red-500'} border-2 border-white rounded-full"></div>
                </div>
                <div class="flex-1">
                    <p class="text-sm text-gray-700"><strong class="text-gray-900 text-base">${fac.username || interest.faculty_username}</strong> ${statusMsg}</p>
                    ${fac.default_status ? `<p class="text-sm text-gray-600 mt-1 bg-gray-100 inline-block px-3 py-1.5 rounded-lg font-medium border border-gray-200">"${fac.default_status}"</p>` : ''}
                    <p class="text-xs text-gray-400 mt-2"><i class="bi bi-clock mr-1"></i>Just updated</p>
                </div>
                <button onclick="initiateNewChat(${interest.faculty}, '${fac.slug}', '${(fac.username || interest.faculty_username).replace(/'/g, "\\\\'")}')" class="text-gray-400 hover:text-blue-500 bg-white border border-gray-200 hover:border-blue-200 p-2 rounded-xl shadow-sm transition-all"><i class="bi bi-chat-text"></i></button>
            </div>
        `;
    }).join('');
}

async function searchFaculties() {
    const query = document.getElementById('facultySearch').value.toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    
    if (query.length < 2) {
        resultsDiv.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Type at least 2 characters...</p>';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/student-interests/search_faculties/?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (!response.ok) throw new Error('Search failed');
        
        const matched = await response.json();
        
        if (!matched.length) {
            resultsDiv.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">No faculties found.</p>';
            return;
        }
        
        resultsDiv.innerHTML = matched.map(u => `
            <div class="flex items-center justify-between p-2 hover:bg-gray-50 rounded border-b">
                <div class="flex items-center gap-3">
                    <img src="${u.profile_image_url || '../static/images/image.png'}" class="w-8 h-8 rounded-full">
                    <div>
                        <p class="text-sm font-medium">${u.username}</p>
                        <p class="text-xs text-gray-500">${u.designation || 'Faculty'}</p>
                    </div>
                </div>
                <button onclick="addFaculty(${u.user})" class="bg-orange-100 text-orange-600 px-3 py-1 text-xs rounded hover:bg-orange-200">Add</button>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
        resultsDiv.innerHTML = '<p class="text-xs text-red-500 text-center">Search error.</p>';
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

function toggleBellDropdown(interestId) {
    var drop = document.getElementById('bellDrop_' + interestId);
    if (!drop) return;
    var isHidden = drop.classList.contains('hidden');
    // Close all other dropdowns first
    document.querySelectorAll('[id^="bellDrop_"]').forEach(function (d) { d.classList.add('hidden'); });
    if (isHidden) {
        drop.classList.remove('hidden');
        // Close on outside click
        setTimeout(function () {
            document.addEventListener('click', function _closeBell(e) {
                if (!drop.contains(e.target) && !e.target.closest('#bellWrap_' + interestId)) {
                    drop.classList.add('hidden');
                    document.removeEventListener('click', _closeBell);
                }
            });
        }, 10);
    }
}

async function setNotifyPref(interestId, pref) {
    // Close dropdown
    var drop = document.getElementById('bellDrop_' + interestId);
    if (drop) drop.classList.add('hidden');
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
