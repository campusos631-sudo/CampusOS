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
