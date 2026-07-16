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
        : 'https://sir-kothay-server.onrender.com';
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
    HEALTH: API_BASE_URL + '/api/health/',

    // Auth
    LOGIN: API_BASE_URL + '/api/auth/users/login/',
    REGISTER: API_BASE_URL + '/api/auth/users/register/',
    CURRENT_USER: API_BASE_URL + '/api/auth/users/me/',
    CHANGE_PASSWORD: API_BASE_URL + '/api/auth/users/change_password/',
    DELETE_ACCOUNT: API_BASE_URL + '/api/auth/users/delete_account/',

    // Dashboard
    USER_DETAILS: API_BASE_URL + '/api/dashboard/user-details/my_details/',
    UPDATE_USER_DETAILS: API_BASE_URL + '/api/dashboard/user-details/update_my_details/',
    STUDENT_AVAILABLE_COUNT: API_BASE_URL + '/api/dashboard/student-interests/available_count/',

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

(function () {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    if (window.SKBackendStatus) return;

    var nativeFetch = window.fetch.bind(window);
    var state = 'unknown';
    var lastChangeAt = 0;
    var pollTimer = null;
    var checking = false;
    var checkPromise = null;
    var failureCount = 0;
    var healthFailureCount = 0;
    var lastHealthyAt = 0;
    var nextDelayOverride = null;
    var backoffMs = [2000, 5000, 10000, 30000];

    function isBackendUrl(input) {
        try {
            var raw = typeof input === 'string' ? input : (input && input.url);
            if (!raw) return false;
            var url = new URL(raw, window.location.href);
            var base = new URL(API_BASE_URL, window.location.href);
            return url.origin === base.origin && url.pathname.indexOf('/api/') === 0;
        } catch (e) {
            return false;
        }
    }

    function isHealthUrl(input) {
        try {
            var raw = typeof input === 'string' ? input : (input && input.url);
            if (!raw) return false;
            var url = new URL(raw, window.location.href);
            return url.href.split('?')[0].replace(/\/$/, '') === API_ENDPOINTS.HEALTH.replace(/\/$/, '');
        } catch (e) {
            return false;
        }
    }

    function ensureBanner() {
        if (typeof document === 'undefined' || document.getElementById('skBackendStatus')) return;
        var banner = document.createElement('div');
        banner.id = 'skBackendStatus';
        banner.className = 'sk-backend-status hidden';
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        banner.innerHTML =
            '<span class="sk-backend-status-dot"></span>' +
            '<span class="sk-backend-status-text">Backend unavailable. Trying to reconnect...</span>' +
            '<button type="button" class="sk-backend-status-retry">Retry</button>';
        document.body.appendChild(banner);
        var retry = banner.querySelector('.sk-backend-status-retry');
        if (retry) {
            retry.addEventListener('click', function () {
                checkHealth('manual');
            });
        }
    }

    function renderBanner() {
        if (typeof document === 'undefined') return;
        ensureBanner();
        var banner = document.getElementById('skBackendStatus');
        if (!banner) return;
        var text = banner.querySelector('.sk-backend-status-text');
        var retry = banner.querySelector('.sk-backend-status-retry');

        banner.classList.remove('is-offline', 'is-checking', 'hidden');
        if (state === 'offline') {
            banner.classList.add('is-offline');
            if (text) text.textContent = 'Backend unavailable. Trying to reconnect...';
            if (retry) {
                retry.disabled = checking;
                retry.textContent = checking ? 'Retrying...' : 'Retry';
            }
            if (checking) banner.classList.add('is-checking');
            return;
        }

        banner.classList.add('hidden');
    }

    function notify(next, detail) {
        if (state === next && !detail) {
            renderBanner();
            return;
        }
        var previous = state;
        state = next;
        lastChangeAt = Date.now();
        if (state === 'online') {
            failureCount = 0;
            healthFailureCount = 0;
            lastHealthyAt = Date.now();
        }
        renderBanner();
        if (typeof window.CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('sk:backend-status', {
                detail: Object.assign({ status: state, previous: previous }, detail || {})
            }));
        }
    }

    function markOnline(detail) {
        notify('online', detail);
    }

    function markOffline(detail) {
        failureCount += 1;
        notify('offline', detail);
    }

    function noteHealthFailure(detail) {
        healthFailureCount += 1;
        var recentlyHealthy = lastHealthyAt && Date.now() - lastHealthyAt < 8000;
        if (state === 'online' && recentlyHealthy && healthFailureCount < 2) {
            nextDelayOverride = 1500;
            renderBanner();
            scheduleNextCheck(1500);
            return;
        }
        markOffline(detail);
    }

    function noteApiFailure(detail) {
        var recentlyHealthy = lastHealthyAt && Date.now() - lastHealthyAt < 8000;
        if (state === 'online' && recentlyHealthy) {
            healthFailureCount = Math.max(healthFailureCount, 1);
            nextDelayOverride = 1200;
            scheduleNextCheck(1200);
            return;
        }
        markOffline(detail);
    }

    function clearPoll() {
        if (pollTimer) {
            window.clearTimeout(pollTimer);
            pollTimer = null;
        }
    }

    function scheduleNextCheck(delayOverride) {
        clearPoll();
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        var delay = delayOverride || nextDelayOverride || (state === 'offline'
            ? backoffMs[Math.min(failureCount - 1, backoffMs.length - 1)]
            : 15000);
        nextDelayOverride = null;
        pollTimer = window.setTimeout(function () {
            checkHealth('poll');
        }, delay || 15000);
    }

    async function checkHealth(reason) {
        if (checking && checkPromise) return checkPromise;
        checking = true;
        checkPromise = (async function () {
            renderBanner();
            var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 4500) : null;
            try {
                var res = await nativeFetch(API_ENDPOINTS.HEALTH, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                    signal: controller ? controller.signal : undefined
                });
                if (res.ok) markOnline({ reason: reason || 'health' });
                else noteHealthFailure({ reason: reason || 'health', statusCode: res.status });
            } catch (e) {
                noteHealthFailure({ reason: reason || 'health', error: e && e.name === 'AbortError' ? 'timeout' : 'network' });
            } finally {
                if (timeout) window.clearTimeout(timeout);
                checking = false;
                renderBanner();
                scheduleNextCheck();
                var result = state;
                checkPromise = null;
                return result;
            }
        })();
        return checkPromise;
    }

    window.fetch = function (input, init) {
        var backendRequest = isBackendUrl(input);
        var healthRequest = isHealthUrl(input);
        return nativeFetch(input, init).then(function (response) {
            if (backendRequest && !healthRequest) {
                if ([502, 503, 504].indexOf(response.status) !== -1) {
                    markOffline({ reason: 'api-response', statusCode: response.status });
                    scheduleNextCheck();
                } else {
                    markOnline({ reason: 'api-response', statusCode: response.status });
                    scheduleNextCheck();
                }
            }
            return response;
        }).catch(function (error) {
            if (backendRequest) {
                noteApiFailure({ reason: 'api-error', error: error && error.name ? error.name : 'network' });
            }
            throw error;
        });
    };

    window.SKBackendStatus = {
        check: checkHealth,
        getState: function () { return state; },
        isOnline: function () { return state === 'online'; },
        markOnline: markOnline,
        markOffline: markOffline,
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', function () {
            ensureBanner();
            checkHealth('load');
        });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') checkHealth('visible');
            else clearPoll();
        });
    }
    window.addEventListener('online', function () { checkHealth('browser-online'); });
    window.addEventListener('offline', function () {
        markOffline({ reason: 'browser-offline' });
        clearPoll();
    });
})();

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
