// Shared helpers used by every CampusOS page

function getToken() {
  return localStorage.getItem('token');
}

// Calls the API with the saved JWT token and returns { ok, status, data }
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  const res = await fetch('/api' + path, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body */ }

  // Expired or invalid token: send the user back to the login page
  if (res.status === 401 && token) {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  }
  return { ok: res.ok, status: res.status, data };
}

// Page guard: returns the logged-in user, or redirects to login
async function requireLogin(role) {
  if (!getToken()) {
    window.location.href = '/login.html';
    return null;
  }
  const r = await api('/auth/me');
  if (!r.ok) return null;
  if (role && r.data.user.role !== role) {
    window.location.href = r.data.user.role === 'admin' ? '/admin.html' : '/dashboard.html';
    return null;
  }
  return r.data.user;
}

function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login.html';
}

// Escapes text before putting it in HTML, which prevents XSS attacks
function esc(text) {
  const d = document.createElement('div');
  d.textContent = text == null ? '' : String(text);
  return d.innerHTML;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusBadge(status) {
  const cls = 's-' + status.toLowerCase().replace(/\s+/g, '-');
  return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
}

function showMsg(el, type, text) {
  el.className = 'msg ' + type;
  el.textContent = text;
}

// ---- Notification bell: adds itself to every page that has a .topbar ----
(function () {
  const css = `
    .bell-wrap { position: relative; display: inline-block; margin-right: 8px; vertical-align: middle; }
    .bell { position: relative; background: transparent; border: 1px solid var(--border); color: var(--text);
            border-radius: 10px; padding: 6px 10px; font-size: 1.05rem; cursor: pointer; line-height: 1; }
    .bell:hover { background: var(--card-hover); }
    .bell-count { position: absolute; top: -7px; right: -7px; min-width: 18px; height: 18px; padding: 0 5px;
                  border-radius: 9px; background: var(--danger); color: #fff; font-size: .7rem; font-weight: 700;
                  display: none; align-items: center; justify-content: center; }
    .bell-panel { display: none; position: fixed; top: 58px; right: 8px; width: calc(100vw - 16px); max-width: 360px;
                  max-height: 70vh; overflow-y: auto; background: var(--card); border: 1px solid var(--border);
                  border-radius: 14px; box-shadow: 0 10px 30px rgba(0, 0, 0, .45); z-index: 50; text-align: left; }
    .bell-panel h3 { margin: 0; padding: 12px 14px; font-size: .95rem; border-bottom: 1px solid var(--border); }
    .bell-item { padding: 10px 14px; border-bottom: 1px solid var(--border); font-size: .88rem; }
    .bell-item.unread { background: rgba(59, 130, 246, .12); border-left: 3px solid var(--primary); }
    .bell-item .when { color: var(--muted); font-size: .75rem; margin-top: 2px; }
    .bell-empty { padding: 20px; text-align: center; color: var(--muted); font-size: .9rem; }
  `;

  function init() {
    const bar = document.querySelector('.topbar');
    if (!bar || !getToken()) return;
    const right = bar.lastElementChild;
    if (!right) return;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const wrap = document.createElement('span');
    wrap.className = 'bell-wrap';
    wrap.innerHTML =
      '<button type="button" class="bell" aria-label="Notifications">&#128276;' +
      '<span class="bell-count" id="bellCount"></span></button>' +
      '<div class="bell-panel" id="bellPanel"></div>';
    right.insertBefore(wrap, right.firstChild);

    const countEl = wrap.querySelector('#bellCount');
    const panel = wrap.querySelector('#bellPanel');
    let items = [];

    function setCount(n) {
      countEl.textContent = n > 9 ? '9+' : String(n);
      countEl.style.display = n > 0 ? 'flex' : 'none';
    }

    async function refresh() {
      const r = await api('/notifications');
      if (!r.ok) return;
      items = r.data.notifications;
      setCount(r.data.unread);
    }

    function render() {
      panel.innerHTML = '<h3>Notifications</h3>' + (items.length === 0
        ? '<div class="bell-empty">No notifications yet.</div>'
        : items.map(n =>
            '<div class="bell-item' + (n.is_read ? '' : ' unread') + '">' + esc(n.message) +
            '<div class="when">' + fmtDate(n.created_at) + '</div></div>').join(''));
    }

    wrap.querySelector('.bell').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
      await refresh();
      render();
      panel.style.display = 'block';
      // Unread ones stay highlighted now, and are marked read on the server
      if (items.some(n => !n.is_read)) {
        await api('/notifications/read-all', { method: 'PUT' });
        setCount(0);
      }
    });

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) panel.style.display = 'none';
    });

    refresh();
    setInterval(refresh, 60000); // checks for new notifications every minute
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
