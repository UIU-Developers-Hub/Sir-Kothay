// API base: set window.SIR_KOTHAY_API_BASE before this script to override (e.g. production).
// Default local backend: uses the same hostname the page was opened from, port 8000.
// This allows mobile devices on the LAN to reach the Django server automatically.
(function () {
    var host = typeof window !== 'undefined' ? window.location.hostname : '';
    // If we are on a local development IP (localhost, 127.0.0.1, or LAN IPs like 192.168.x.x / 10.x.x.x)
    var isLocal =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '' ||
        host === '[::1]' ||
        host.startsWith('192.168.') ||
        host.startsWith('10.');
        
    // Always map local development to port 8000 on the same IP so `python manage.py runserver 0.0.0.0:8000` works on mobile
    var defaultBase = isLocal
        ? 'http://' + (host || '127.0.0.1') + ':8000'
        : 'https://TahsinFaiyaz30.pythonanywhere.com';
    var raw =
        (typeof window !== 'undefined' && window.SIR_KOTHAY_API_BASE) ||
        defaultBase;
    window.SIR_KOTHAY_API_BASE = String(raw).replace(/\/$/, '');
})();

var API_BASE_URL = window.SIR_KOTHAY_API_BASE;

/** GitHub owner/repo for contributor widgets (About page, footer). */
var GITHUB_REPO = 'UIU-Developers-Hub/Sir-Kothay';

function sirKothayContributorsApiUrl() {
    return 'https://api.github.com/repos/' + GITHUB_REPO + '/contributors';
}

window.sirKothayContributorsApiUrl = sirKothayContributorsApiUrl;

// API Endpoints
var API_ENDPOINTS = {
    // Auth
    LOGIN: API_BASE_URL + '/api/auth/users/login/',
    REGISTER: API_BASE_URL + '/api/auth/users/register/',
    CURRENT_USER: API_BASE_URL + '/api/auth/users/me/',
    CHANGE_PASSWORD: API_BASE_URL + '/api/auth/users/change_password/',

    // Dashboard
    USER_DETAILS: API_BASE_URL + '/api/dashboard/user-details/my_details/',
    UPDATE_USER_DETAILS: API_BASE_URL + '/api/dashboard/user-details/update_my_details/',

    // QR
    MY_QRCODE: API_BASE_URL + '/api/qrcode/qrcodes/my_qrcode/',
    GENERATE_QR: API_BASE_URL + '/api/qrcode/qrcodes/generate/',
    /** Authenticated PNG for dashboard canvas export (not the public /media/ URL). */
    QR_PNG_EXPORT: API_BASE_URL + '/api/qrcode/qrcodes/qr_png/',
    /** Footer banner PNG for "QR with user info" export (same file as client/static/images/qr/footer.png). */
    FOOTER_PNG_EXPORT: API_BASE_URL + '/api/qrcode/qrcodes/footer_png/',

    // Broadcast Messages
    MESSAGES: API_BASE_URL + '/api/broadcast/messages/my_messages/',
    ACTIVE_MESSAGE: API_BASE_URL + '/api/broadcast/messages/active_message/',
    CREATE_MESSAGE: API_BASE_URL + '/api/broadcast/messages/',

    // Direct Messaging
    DM_INBOX: API_BASE_URL + '/api/messaging/inbox/',
    DM_UNREAD: API_BASE_URL + '/api/messaging/unread/',

    // Scheduler — Recurring
    RECURRING_LIST: API_BASE_URL + '/api/scheduler/recurring/',

    // Scheduler — Calendar
    CALENDAR_LIST: API_BASE_URL + '/api/scheduler/calendar/',

    // Scheduler — Quick Templates
    TEMPLATES_LIST: API_BASE_URL + '/api/scheduler/templates/',

    // Analytics
    ANALYTICS: API_BASE_URL + '/api/scheduler/analytics/',
    ANALYTICS_TRACK: API_BASE_URL + '/api/scheduler/analytics/track/',

    // Notifications — Subscribers
    SUBSCRIBERS: API_BASE_URL + '/api/notifications/subscribers/',

    // Chat Threads
    CHAT_INITIATE: API_BASE_URL + '/api/messaging/chat/initiate/',
    CHAT_THREADS: API_BASE_URL + '/api/messaging/chat/threads/',
};

/**
 * Build a public endpoint URL dynamically (e.g. for DM send, subscribe).
 */
function buildPublicUrl(path) {
    return API_BASE_URL + path;
}

/**
 * Resolve a profile image URL from the API into a full absolute URL.
 * Handles: null/undefined → fallback, relative paths → API_BASE_URL prefix,
 * already-absolute URLs → pass-through.
 * @param {string|null|undefined} url - The profile_image or profile_image_url value from the API
 * @param {string} [fallback] - Fallback image path (default: '../static/images/image.png')
 * @returns {string} Full image URL ready for <img src>
 */
function resolveProfileImage(url, fallback) {
    if (!url) return fallback || '../static/images/image.png';
    // Already absolute (http/https/data URI)
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    // Relative path from API — prepend base URL
    return API_BASE_URL + url;
}

function getAuthToken() {
    return localStorage.getItem('access_token');
}

async function apiRequest(url, options) {
    options = options || {};
    var token = getAuthToken();
    var defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    if (token) {
        defaultOptions.headers.Authorization = 'Bearer ' + token;
    }
    var mergedOptions = Object.assign({}, defaultOptions, options);
    mergedOptions.headers = Object.assign(
        {},
        defaultOptions.headers,
        (options && options.headers) || {}
    );
    try {
        return await fetch(url, mergedOptions);
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

/**
 * GET binary (e.g. PNG) with JWT. Does not set Content-Type: application/json (that can break some proxies / odd stacks).
 */
async function apiFetchImage(url) {
    var token = getAuthToken();
    var headers = { Accept: 'image/png,image/*;q=0.9,*/*;q=0.1' };
    if (token) {
        headers.Authorization = 'Bearer ' + token;
    }
    return fetch(url, { method: 'GET', headers: headers, mode: 'cors', cache: 'no-store' });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_BASE_URL: API_BASE_URL,
        API_ENDPOINTS: API_ENDPOINTS,
        getAuthToken: getAuthToken,
        apiRequest: apiRequest,
        apiFetchImage: apiFetchImage,
        sirKothayContributorsApiUrl: sirKothayContributorsApiUrl,
        buildPublicUrl: buildPublicUrl,
        resolveProfileImage: resolveProfileImage,
    };
}
