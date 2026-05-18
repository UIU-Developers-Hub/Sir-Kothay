let adminUsers = [];

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
    
    await verifyAdminAndLoad();
});

async function verifyAdminAndLoad() {
    try {
        // First check role
        const meRes = await fetch(`${API_BASE_URL}/api/auth/users/me/`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (!meRes.ok) throw new Error('Auth failed');
        const me = await meRes.json();
        
        if (me.role !== 'ADMIN') {
            // Not an admin, redirect based on role
            window.location.href = me.role === 'STUDENT' ? 'student.html' : 'home.html';
            return;
        }

        // Load users
        const usersRes = await fetch(`${API_BASE_URL}/api/dashboard/admin-users/`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (!usersRes.ok) throw new Error('Failed to load users');
        
        adminUsers = await usersRes.json();
        
        document.getElementById('totalUsersCount').textContent = adminUsers.length;
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        
        renderAdminUsers();
    } catch (error) {
        console.error(error);
        showNotifyModal('Error loading admin panel.', 'error');
        localStorage.removeItem('access_token');
        setTimeout(() => window.location.href = '../auth/login.html', 2000);
    }
}

function renderAdminUsers() {
    const query = document.getElementById('adminSearch').value.toLowerCase();
    const tbody = document.getElementById('adminUsersTable');
    const emptyMsg = document.getElementById('emptyTableMessage');
    
    const filtered = adminUsers.filter(u => 
        u.username.toLowerCase().includes(query) || 
        u.email.toLowerCase().includes(query) ||
        (u.student_id && u.student_id.toLowerCase().includes(query))
    );
    
    if (!filtered.length) {
        tbody.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        return;
    }
    
    emptyMsg.classList.add('hidden');
    
    tbody.innerHTML = filtered.map(u => {
        const statusBadge = u.is_active 
            ? '<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">Active</span>'
            : '<span class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">Banned/Inactive</span>';
            
        const toggleBtnText = u.is_active ? 'Ban / Deactivate' : 'Activate';
        const toggleBtnClass = u.is_active ? 'text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100' : 'text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100';
        
        // Show QR link for faculty
        const qrLink = u.role === 'FACULTY' ? `<a href="../broadcast/qr.html?u=${u.id}" target="_blank" class="text-blue-500 hover:underline mr-3"><i class="bi bi-qr-code"></i> View QR</a>` : '';
        
        return `
            <tr class="hover:bg-gray-50 transition">
                <td class="p-3">${u.id}</td>
                <td class="p-3 font-medium text-gray-800">
                    ${u.username}
                    ${u.student_id ? `<br><span class="text-xs text-gray-500">ID: ${u.student_id}</span>` : ''}
                </td>
                <td class="p-3 text-gray-600">${u.email}</td>
                <td class="p-3">
                    <span class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-semibold">${u.role}</span>
                </td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-center">
                    ${qrLink}
                    <button onclick="toggleUserStatus(${u.id})" class="px-3 py-1 rounded text-xs font-medium transition ${toggleBtnClass}">
                        ${toggleBtnText}
                    </button>
                    <button onclick="deleteUser(${u.id})" class="text-gray-400 hover:text-red-600 ml-2 transition">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleUserStatus(userId) {
    if (!confirm('Are you sure you want to change this user\'s status?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/admin-users/${userId}/toggle_active/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to update status');
        
        const data = await response.json();
        
        // Update local state
        const user = adminUsers.find(u => u.id === userId);
        if (user) user.is_active = data.is_active;
        
        renderAdminUsers();
        showNotifyModal('User status updated.', 'success');
    } catch (error) {
        showNotifyModal(error.message, 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('WARNING: This will permanently delete the user and all their data. Proceed?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/admin-users/${userId}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to delete user');
        
        // Update local state
        adminUsers = adminUsers.filter(u => u.id !== userId);
        
        renderAdminUsers();
        showNotifyModal('User deleted.', 'success');
    } catch (error) {
        showNotifyModal(error.message, 'error');
    }
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '../auth/login.html';
}
