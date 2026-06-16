/* ============================================================================
   Marsh core client — API wrapper, CSRF, auth, UI helpers
   ========================================================================== */

const Marsh = (() => {
  // API base. Same origin in production; override for local cross-origin dev.
  const API_BASE = window.MARSH_API_BASE || '';

  let csrfToken = null;

  /* ------------------------------ CSRF token ------------------------------ */
  async function ensureCsrf() {
    if (csrfToken) return csrfToken;
    const res = await fetch(`${API_BASE}/api/csrf-token`, {
      credentials: 'include',
    });
    const data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken;
  }

  /* ------------------------------- Fetch core ----------------------------- */
  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headers },
    };

    if (body !== undefined) opts.body = JSON.stringify(body);

    // Attach CSRF token for mutating requests
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const token = await ensureCsrf();
      opts.headers['X-CSRF-Token'] = token;
    }

    const res = await fetch(`${API_BASE}${path}`, opts);

    let payload = null;
    try { payload = await res.json(); } catch (_) { /* no body */ }

    if (!res.ok) {
      // CSRF token may have rotated — reset so next call refetches
      if (res.status === 403) csrfToken = null;
      const message = payload?.error || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    return payload?.data ?? payload;
  }

  const api = {
    get: (p) => request(p),
    post: (p, body) => request(p, { method: 'POST', body }),
    put: (p, body) => request(p, { method: 'PUT', body }),
    del: (p) => request(p, { method: 'DELETE' }),
  };

  /* --------------------------------- Auth --------------------------------- */
  const auth = {
    async register(name, email, password, country, phone) {
      return api.post('/api/auth/register', { name, email, password, country, phone });
    },
    async login(email, password) {
      return api.post('/api/auth/login', { email, password });
    },
    async logout() {
      try { await api.post('/api/auth/logout'); } catch (_) {}
      csrfToken = null;
      window.location.href = '/';
    },
    async me() {
      const data = await api.get('/api/auth/me');
      return data.user;
    },
  };

  /* ------------------------------- Guards --------------------------------- */
  // Redirect to /login if not authenticated. Returns the user or null.
  async function requireAuth({ admin = false } = {}) {
    try {
      const user = await auth.me();
      if (admin && user.role !== 'admin') {
        toast('Admin access required.', 'error');
        setTimeout(() => (window.location.href = '/dashboard'), 1200);
        return null;
      }
      return user;
    } catch (err) {
      window.location.href = '/login';
      return null;
    }
  }

  /* -------------------------------- Toast --------------------------------- */
  function toast(message, type = 'info', timeout = 3500) {
    let root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      document.body.appendChild(root);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(40px)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, timeout);
  }

  /* ------------------------------ Formatting ------------------------------ */
  const fmt = {
    usd(n) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }).format(Number(n) || 0);
    },
    date(d) {
      if (!d) return '—';
      return new Date(d).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    },
    dateShort(d) {
      if (!d) return '—';
      return new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' });
    },
    initials(name = '') {
      return name
        .split(' ')
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'M';
    },
  };

  /* -------------------------- Avatar rendering ---------------------------- */
  function avatarHTML(user, cls = 'avatar') {
    if (user.profilePicture) {
      return `<img src="${user.profilePicture}" alt="${user.name}" class="${cls}"
        referrerpolicy="no-referrer"
        onerror="this.outerHTML='<div class=\\'avatar-fallback\\'>${fmt.initials(user.name)}</div>'">`;
    }
    return `<div class="avatar-fallback">${fmt.initials(user.name)}</div>`;
  }

  return { api, auth, requireAuth, toast, fmt, avatarHTML, ensureCsrf, API_BASE };
})();
