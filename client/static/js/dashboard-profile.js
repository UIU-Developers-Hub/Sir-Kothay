window.SKDashboardProfile = (() => {
  'use strict';

  let activeRoot = null;
  let defaultTab = 'messages';
  let liveTimer = null;
  let liveInFlight = false;
  let dirty = false;

  const LIVE_INTERVAL_MS = 15000;

  function esc(value) {
    return SKUtils.escapeHtml(value == null ? '' : String(value));
  }

  function resolveImage(url) {
    if (window.SKUtils && SKUtils.resolveProfileImage) return SKUtils.resolveProfileImage(url);
    if (typeof resolveProfileImage === 'function') return resolveProfileImage(url);
    return url || '../static/images/image.png';
  }

  function notify(message, variant) {
    if (typeof skNotify !== 'undefined') return skNotify(message, { variant: variant || 'info' });
    if (window.SKComponents && SKComponents.toast) return SKComponents.toast(message, variant || 'info');
    return alert(message);
  }

  function field(name) {
    return activeRoot ? activeRoot.querySelector('[data-profile-field="' + name + '"]') : null;
  }

  function action(name) {
    return activeRoot ? activeRoot.querySelector('[data-profile-action="' + name + '"]') : null;
  }

  function setText(name, value) {
    var el = field(name);
    if (el) el.textContent = value || '';
  }

  function setValue(name, value) {
    var el = field(name);
    if (el) el.value = value || '';
  }

  function roleBadge(role) {
    if (role === 'STUDENT') {
      return '<span class="sk-badge sk-ex-d4d873f3"><i class="bi bi-mortarboard-fill me-1"></i>Student</span>';
    }
    if (role === 'FACULTY') {
      return '<span class="sk-badge sk-ex-ff55c2e2"><i class="bi bi-person-workspace me-1"></i>Faculty</span>';
    }
    return '<span class="sk-badge sk-ex-4b7f3130"><i class="bi bi-shield-lock me-1"></i>Admin</span>';
  }

  function render() {
    return `
      <div class="sk-profile-panel">
        <header class="sk-page-header-row">
          <div>
            <h1 class="sk-page-title">Profile Settings</h1>
            <p class="sk-page-subtitle">Manage your personal information and preferences.</p>
          </div>
        </header>

        <div class="sk-card sk-profile-shell">
          <div class="sk-profile-header">
            <button type="button" class="sk-profile-avatar-container" data-profile-action="avatar" title="Change Profile Image" aria-label="Change Profile Image">
              <img data-profile-field="profileImage" src="../static/images/image.png" alt="User Avatar">
              <span class="sk-profile-avatar-edit"><i class="bi bi-pencil-fill"></i></span>
            </button>
          </div>
          <div class="sk-profile-info">
            <h2 data-profile-field="displayName">Loading...</h2>
            <div class="sk-profile-meta">
              <span><i class="bi bi-envelope me-1"></i><span data-profile-field="displayEmail">...</span></span>
              <span data-profile-field="displayRoleBadge"></span>
            </div>
          </div>
        </div>

        <form data-profile-form="details" enctype="multipart/form-data">
          <input type="file" data-profile-field="profileImageInput" name="profile_image" accept="image/*" class="hidden" aria-label="Profile image" title="Profile image">

          <div class="sk-profile-grid">
            <div class="sk-profile-form-section">
              <div class="sk-section-title">
                <i class="bi bi-person-badge text-primary"></i> Basic Information
              </div>
              <div class="sk-form-group">
                <label class="sk-label">Full Name</label>
                <input type="text" data-profile-field="username" name="username" required class="sk-input" placeholder="e.g. John Doe">
              </div>
              <div class="sk-form-group">
                <label class="sk-label">Email Address</label>
                <input type="email" data-profile-field="email" name="email" required class="sk-input" placeholder="you@example.com">
              </div>
              <div class="sk-form-group hidden" data-profile-field="studentIdGroup">
                <label class="sk-label">Student ID</label>
                <input type="text" data-profile-field="studentId" name="student_id" class="sk-input" placeholder="e.g. 011242111">
                <p class="sk-help-text text-primary sk-ex-388c7749"><i class="bi bi-info-circle me-1"></i>Your Student ID must be unique.</p>
              </div>
              <div class="sk-form-group">
                <label class="sk-label">Phone Number (Optional)</label>
                <input type="tel" data-profile-field="phoneNumber" name="phone_number" class="sk-input" placeholder="+880...">
              </div>
            </div>

            <div class="sk-profile-form-section">
              <div class="sk-section-title">
                <i class="bi bi-briefcase text-primary"></i> Professional Details
              </div>
              <div class="sk-form-group">
                <label class="sk-label">Organization / University</label>
                <input type="text" data-profile-field="organization" name="organization" class="sk-input" placeholder="e.g. United International University">
              </div>
              <div class="sk-form-group">
                <label class="sk-label">Designation / Role</label>
                <input type="text" data-profile-field="designation" name="designation" class="sk-input" placeholder="e.g. Senior Lecturer">
              </div>
            </div>
          </div>

          <div class="sk-profile-form-section sk-ex-fc511f0c">
            <div class="sk-section-title">
              <i class="bi bi-chat-quote text-primary"></i> About You
            </div>
            <div class="sk-form-group">
              <label class="sk-label">Bio</label>
              <textarea data-profile-field="bio" name="bio" rows="4" placeholder="Write a short bio about yourself..." class="sk-textarea"></textarea>
            </div>
          </div>

          <div class="sk-profile-actions">
            <button type="button" data-profile-action="cancel" class="sk-btn sk-btn-secondary">Cancel</button>
            <button type="submit" data-profile-action="save" class="sk-btn sk-btn-primary">
              <i class="bi bi-check2-circle me-1"></i> Save Changes
            </button>
          </div>
        </form>

        <form data-profile-form="password">
          <div class="sk-profile-form-section sk-ex-a20192ee">
            <div class="sk-section-title">
              <i class="bi bi-shield-lock text-primary"></i> Security (Change Password)
            </div>

            <div class="sk-profile-grid">
              <div class="sk-form-group">
                <label class="sk-label">Current Password</label>
                <div class="sk-password-input-wrap">
                  <input type="password" data-profile-field="oldPassword" class="sk-input" placeholder="Enter current password" required>
                  <button type="button" data-profile-toggle="oldPassword" aria-label="Show current password" title="Show current password"><i class="bi bi-eye"></i></button>
                </div>
              </div>
              <div class="sk-form-group">
                <label class="sk-label">New Password</label>
                <div class="sk-password-input-wrap">
                  <input type="password" data-profile-field="newPassword" class="sk-input" placeholder="Enter new password" required>
                  <button type="button" data-profile-toggle="newPassword" aria-label="Show new password" title="Show new password"><i class="bi bi-eye"></i></button>
                </div>
              </div>
              <div class="sk-form-group">
                <label class="sk-label">Confirm New Password</label>
                <div class="sk-password-input-wrap">
                  <input type="password" data-profile-field="confirmPassword" class="sk-input" placeholder="Confirm new password" required>
                  <button type="button" data-profile-toggle="confirmPassword" aria-label="Show confirmed password" title="Show confirmed password"><i class="bi bi-eye"></i></button>
                </div>
              </div>
            </div>

            <div class="sk-profile-actions compact">
              <button type="submit" data-profile-action="password" class="sk-btn sk-btn-warning">
                <i class="bi bi-key me-1"></i> Update Password
              </button>
            </div>
          </div>
        </form>

        <div class="sk-profile-form-section sk-ex-danger-zone">
          <div class="sk-section-title" style="color:var(--clr-danger,#ef4444)">
            <i class="bi bi-exclamation-triangle-fill"></i> Danger Zone
          </div>
          <p class="sk-help-text" style="margin-bottom:.75rem">Permanently delete your account and all associated data. This action cannot be undone.</p>
          <button type="button" data-profile-action="deleteAccount" class="sk-btn sk-btn-danger">
            <i class="bi bi-trash3 me-1"></i> Delete My Account
          </button>
        </div>
      </div>
    `;
  }

  function bind(root) {
    var detailsForm = root.querySelector('[data-profile-form="details"]');
    var passwordForm = root.querySelector('[data-profile-form="password"]');
    var fileInput = root.querySelector('[data-profile-field="profileImageInput"]');

    var avatarButton = root.querySelector('[data-profile-action="avatar"]');
    if (avatarButton && fileInput) {
      avatarButton.addEventListener('click', function () {
        fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        previewProfileImage(fileInput);
      });
    }

    if (detailsForm) {
      detailsForm.addEventListener('input', function () {
        dirty = true;
      });
      detailsForm.addEventListener('submit', saveProfile);
    }

    if (passwordForm) {
      passwordForm.addEventListener('submit', savePassword);
    }

    root.querySelectorAll('[data-profile-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        togglePassword(button.getAttribute('data-profile-toggle'), button);
      });
    });

    var cancel = root.querySelector('[data-profile-action="cancel"]');
    if (cancel) {
      cancel.addEventListener('click', function () {
        backToDashboard();
      });
    }

    var deleteBtn = root.querySelector('[data-profile-action="deleteAccount"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', deleteAccount);
    }
  }

  function isEditing() {
    if (!activeRoot) return false;
    return dirty || activeRoot.contains(document.activeElement);
  }

  function scheduleLive() {
    if (liveTimer) window.clearTimeout(liveTimer);
    if (document.visibilityState === 'hidden' || !activeRoot) return;
    liveTimer = window.setTimeout(liveTick, LIVE_INTERVAL_MS);
  }

  async function liveTick() {
    if (liveInFlight) {
      scheduleLive();
      return;
    }
    liveInFlight = true;
    try {
      if (!isEditing() && (!window.SKBackendStatus || SKBackendStatus.getState() !== 'offline')) {
        await loadProfile({ silent: true });
      }
    } finally {
      liveInFlight = false;
      scheduleLive();
    }
  }

  function startLive() {
    scheduleLive();
  }

  function stopLive() {
    if (liveTimer) window.clearTimeout(liveTimer);
    liveTimer = null;
  }

  async function loadProfile(options) {
    options = options || {};
    if (!activeRoot) return;
    try {
      var token = localStorage.getItem('access_token');
      var meRes = await fetch(API_ENDPOINTS.CURRENT_USER, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (meRes.status === 401 || meRes.status === 403) {
        window.location.href = '../auth/login.html';
        return;
      }
      if (!meRes.ok) throw new Error('Failed to load user');
      var meData = await meRes.json();
      var role = meData.role || '';

      var res = await fetch(API_ENDPOINTS.USER_DETAILS, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load profile');

      setText('displayName', data.user_username || 'User');
      setText('displayEmail', data.user_email || '');
      var roleEl = field('displayRoleBadge');
      if (roleEl) roleEl.innerHTML = roleBadge(role);

      var image = field('profileImage');
      if (image) image.src = resolveImage(data.profile_image_url || data.profile_image);

      setValue('username', data.user_username || '');
      setValue('email', data.user_email || '');
      setValue('phoneNumber', data.phone_number || '');
      setValue('organization', data.organization || '');
      setValue('designation', data.designation || '');
      setValue('bio', data.bio || '');

      var studentGroup = field('studentIdGroup');
      if (studentGroup) studentGroup.classList.toggle('hidden', role !== 'STUDENT');
      setValue('studentId', role === 'STUDENT' ? (data.user_student_id || '') : '');
      updateDashboardIdentity(data);
    } catch (error) {
      console.error('Profile Load Error:', error);
      if (!options.silent) notify('Failed to load profile details.', 'error');
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    var saveBtn = action('save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="sk-spinner sk-spinner-sm me-2"></span> Saving...';
    }

    var formData = new FormData();
    formData.append('username', (field('username') || {}).value?.trim() || '');
    formData.append('email', (field('email') || {}).value?.trim() || '');
    formData.append('phone_number', (field('phoneNumber') || {}).value?.trim() || '');
    formData.append('organization', (field('organization') || {}).value?.trim() || '');
    formData.append('designation', (field('designation') || {}).value?.trim() || '');
    formData.append('bio', (field('bio') || {}).value?.trim() || '');

    var studentGroup = field('studentIdGroup');
    if (studentGroup && !studentGroup.classList.contains('hidden')) {
      formData.append('student_id', (field('studentId') || {}).value?.trim() || '');
    }

    try {
      var response = await fetch(API_ENDPOINTS.UPDATE_USER_DETAILS, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
        body: formData
      });
      var data = await response.json();
      if (!response.ok) {
        var firstError = Object.values(data)[0];
        var errorText = Array.isArray(firstError) ? firstError[0] : firstError;
        throw new Error(errorText || 'Failed to update profile.');
      }

      dirty = false;
      notify('Profile updated successfully!', 'success');
      if (window.SKLayout && SKLayout.clearUserCache) SKLayout.clearUserCache();
      await loadProfile({ silent: true });
    } catch (error) {
      console.error('Update Error:', error);
      notify(error.message || 'A network error occurred while updating profile.', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Save Changes';
      }
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    var pwdBtn = action('password');
    var oldPassword = (field('oldPassword') || {}).value || '';
    var newPassword = (field('newPassword') || {}).value || '';
    var confirmPassword = (field('confirmPassword') || {}).value || '';

    if (newPassword !== confirmPassword) {
      notify('New passwords do not match.', 'error');
      return;
    }

    if (pwdBtn) {
      pwdBtn.disabled = true;
      pwdBtn.innerHTML = '<span class="sk-spinner sk-spinner-sm me-2"></span> Updating...';
    }

    try {
      var res = await fetch(API_ENDPOINTS.CHANGE_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('access_token')
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password.');
      notify('Password updated successfully.', 'success');
      ['oldPassword', 'newPassword', 'confirmPassword'].forEach(function (name) {
        var input = field(name);
        if (input) input.value = '';
      });
    } catch (error) {
      console.error(error);
      notify(error.message || 'Network error occurred.', 'error');
    } finally {
      if (pwdBtn) {
        pwdBtn.disabled = false;
        pwdBtn.innerHTML = '<i class="bi bi-key me-1"></i> Update Password';
      }
    }
  }

  function togglePassword(name, button) {
    var input = field(name);
    if (!input) return;
    var icon = button ? button.querySelector('i') : null;
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) icon.className = 'bi bi-eye-slash';
    } else {
      input.type = 'password';
      if (icon) icon.className = 'bi bi-eye';
    }
  }

  async function previewProfileImage(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = function (event) {
      var image = field('profileImage');
      if (image) image.src = event.target.result;
    };
    reader.readAsDataURL(file);

    var formData = new FormData();
    formData.append('profile_image', file);
    try {
      var res = await fetch(API_ENDPOINTS.UPDATE_USER_DETAILS, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
        body: formData
      });
      if (!res.ok) {
        var data = await res.json().catch(function () { return {}; });
        var firstError = Object.values(data)[0];
        var errorText = Array.isArray(firstError) ? firstError[0] : firstError;
        throw new Error(errorText || 'Failed to update picture.');
      }
      notify('Profile picture updated successfully!', 'success');
      if (window.SKLayout && SKLayout.clearUserCache) SKLayout.clearUserCache();
      await loadProfile({ silent: true });
    } catch (error) {
      console.error('Image Upload Error:', error);
      notify(error.message || 'Network error occurred while uploading picture.', 'error');
    } finally {
      input.value = '';
    }
  }

  function updateDashboardIdentity(data) {
    if (!data) return;
    var username = data.user_username || '';
    var email = data.user_email || '';
    var imageUrl = resolveImage(data.profile_image_url || data.profile_image);

    document.querySelectorAll('.sk-sidebar-profile-button span').forEach(function (el) {
      el.textContent = username || el.textContent;
    });
    document.querySelectorAll('.sk-sidebar-profile-button .sk-avatar').forEach(function (avatar) {
      if (!imageUrl) return;
      avatar.innerHTML = '<img src="' + esc(imageUrl) + '" alt="' + esc(username || 'User') + '">';
    });

    var dashboardName = document.getElementById('userName');
    if (dashboardName && (!activeRoot || !activeRoot.contains(dashboardName))) dashboardName.textContent = username || 'User';
    var dashboardEmail = document.getElementById('userEmail');
    if (dashboardEmail && (!activeRoot || !activeRoot.contains(dashboardEmail))) dashboardEmail.textContent = email;
    var dashboardImage = document.getElementById('userImage');
    if (dashboardImage && (!activeRoot || !activeRoot.contains(dashboardImage)) && imageUrl) dashboardImage.src = imageUrl;
  }

  async function deleteAccount() {
    // Build two-step modal HTML
    var modalId = 'deleteAccountModal';
    var existing = document.getElementById(modalId);
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'sk-modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML =
      '<div class="sk-modal-panel" style="max-width:440px">' +
        '<div class="sk-modal-header">' +
          '<h3 class="sk-modal-title"><i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>Delete Account</h3>' +
          '<button type="button" class="sk-modal-close" id="delAcctClose" aria-label="Close" title="Close"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '<div class="sk-modal-body">' +
          '<!-- Step 1: Password -->' +
          '<div id="delStep1">' +
            '<p style="margin-bottom:.75rem;color:var(--clr-text-muted,#999)">This will <strong style="color:var(--clr-danger,#ef4444)">permanently delete</strong> your account and all associated data. This action cannot be undone.</p>' +
            '<div class="sk-form-group">' +
              '<label class="sk-label">Enter your password to continue</label>' +
              '<div class="sk-password-input-wrap">' +
                '<input type="password" id="delAcctPassword" class="sk-input" placeholder="Your current password" required>' +
                '<button type="button" id="delAcctTogglePw" aria-label="Show password" title="Show password"><i class="bi bi-eye"></i></button>' +
              '</div>' +
            '</div>' +
            '<p id="delStep1Error" class="sk-help-text" style="color:var(--clr-danger,#ef4444);display:none"></p>' +
          '</div>' +
          '<!-- Step 2: Code -->' +
          '<div id="delStep2" style="display:none">' +
            '<p style="margin-bottom:.75rem;color:var(--clr-text-muted,#999)">A 6-digit confirmation code has been sent to your email. Enter it below to confirm deletion.</p>' +
            '<div class="sk-form-group">' +
              '<label class="sk-label">Confirmation Code</label>' +
              '<input type="text" id="delAcctCode" class="sk-input" placeholder="e.g. 482901" maxlength="6" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" style="letter-spacing:.25em;text-align:center;font-size:1.25rem;font-weight:600" required>' +
            '</div>' +
            '<p id="delStep2Error" class="sk-help-text" style="color:var(--clr-danger,#ef4444);display:none"></p>' +
            '<p class="sk-help-text" style="margin-top:.5rem"><i class="bi bi-clock me-1"></i>Code expires in 10 minutes.</p>' +
          '</div>' +
        '</div>' +
        '<div class="sk-modal-footer">' +
          '<button type="button" class="sk-btn sk-btn-secondary" id="delAcctCancel">Cancel</button>' +
          '<button type="button" class="sk-btn sk-btn-danger" id="delAcctSubmit"><i class="bi bi-arrow-right me-1"></i>Continue</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    var step = 1;
    var closeModal = function () {
      overlay.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onEscKey);
    };

    // Close on Escape key
    function onEscKey(e) { if (e.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', onEscKey);

    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    overlay.querySelector('#delAcctClose').addEventListener('click', closeModal);
    overlay.querySelector('#delAcctCancel').addEventListener('click', closeModal);

    // Password visibility toggle
    overlay.querySelector('#delAcctTogglePw').addEventListener('click', function () {
      var pw = overlay.querySelector('#delAcctPassword');
      var icon = this.querySelector('i');
      if (pw.type === 'password') { pw.type = 'text'; icon.className = 'bi bi-eye-slash'; }
      else { pw.type = 'password'; icon.className = 'bi bi-eye'; }
    });

    // Only allow digits in code field
    overlay.querySelector('#delAcctCode').addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9]/g, '');
    });

    // Allow Enter key to submit
    overlay.querySelector('#delAcctPassword').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); overlay.querySelector('#delAcctSubmit').click(); }
    });
    overlay.querySelector('#delAcctCode').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); overlay.querySelector('#delAcctSubmit').click(); }
    });

    overlay.querySelector('#delAcctSubmit').addEventListener('click', async function () {
      var btn = this;
      var errEl;
      btn.disabled = true;

      if (step === 1) {
        // Step 1: Verify password → send code
        errEl = overlay.querySelector('#delStep1Error');
        errEl.style.display = 'none';
        var password = overlay.querySelector('#delAcctPassword').value;
        if (!password) { errEl.textContent = 'Password is required.'; errEl.style.display = ''; btn.disabled = false; return; }

        btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Sending code...';
        try {
          var token = localStorage.getItem('access_token');
          var res = await fetch(API_ENDPOINTS.REQUEST_DELETE_ACCOUNT, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
          });
          var data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed.');

          // Switch to step 2
          step = 2;
          overlay.querySelector('#delStep1').style.display = 'none';
          overlay.querySelector('#delStep2').style.display = '';
          btn.innerHTML = '<i class="bi bi-trash3 me-1"></i>Delete My Account';
          overlay.querySelector('#delAcctCode').focus();
        } catch (err) {
          errEl.textContent = err.message; errEl.style.display = '';
          btn.innerHTML = '<i class="bi bi-arrow-right me-1"></i>Continue';
        } finally {
          btn.disabled = false;
        }
      } else {
        // Step 2: Verify code → delete account
        errEl = overlay.querySelector('#delStep2Error');
        errEl.style.display = 'none';
        var code = overlay.querySelector('#delAcctCode').value.trim();
        if (!code || code.length !== 6) { errEl.textContent = 'Enter the 6-digit code from your email.'; errEl.style.display = ''; btn.disabled = false; return; }

        btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Deleting...';
        try {
          var token = localStorage.getItem('access_token');
          var res = await fetch(API_ENDPOINTS.CONFIRM_DELETE_ACCOUNT, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
          });
          var data = await res.json().catch(function () { return {}; });
          if (!res.ok) throw new Error(data.error || 'Failed to delete account.');

          closeModal();
          localStorage.clear();
          notify('Your account has been permanently deleted.', 'success');
          setTimeout(function () { window.location.href = '../auth/login.html'; }, 1500);
        } catch (err) {
          errEl.textContent = err.message; errEl.style.display = '';
          btn.innerHTML = '<i class="bi bi-trash3 me-1"></i>Delete My Account';
        } finally {
          btn.disabled = false;
        }
      }
    });
  }

  function backToDashboard() {
    var tabBtn = document.querySelector('.tab-btn[data-tab="' + defaultTab + '"]');
    if (tabBtn) {
      tabBtn.click();
      return;
    }
    window.location.href = defaultTab === 'faculties' ? 'student.html?tab=faculties' : 'home.html?tab=messages';
  }

  async function mount(root, options) {
    options = options || {};
    if (!root) return;
    activeRoot = root;
    defaultTab = options.defaultTab || defaultTab || 'messages';
    if (!root.dataset.profileMounted) {
      root.innerHTML = render();
      bind(root);
      root.dataset.profileMounted = 'true';
    }
    await loadProfile({ silent: !!options.silent });
    startLive();
  }

  function deactivate() {
    stopLive();
  }

  function unmount() {
    stopLive();
    if (activeRoot) {
      activeRoot.innerHTML = '';
      delete activeRoot.dataset.profileMounted;
    }
    activeRoot = null;
    dirty = false;
  }

  document.addEventListener('visibilitychange', function () {
    if (!activeRoot) return;
    if (document.visibilityState === 'visible') {
      startLive();
      if (!isEditing()) loadProfile({ silent: true });
    } else {
      stopLive();
    }
  });

  return {
    mount,
    deactivate,
    unmount,
    refreshIfIdle: function () {
      if (!isEditing()) return loadProfile({ silent: true });
    }
  };
})();
