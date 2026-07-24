const Auth = {
  save(user, token) {
    localStorage.setItem('scms_token', token);
    localStorage.setItem('scms_user', JSON.stringify(user));
  },
  user() {
    try { return JSON.parse(localStorage.getItem('scms_user')); } catch { return null; }
  },
  role() { return (this.user() || {}).role; },
  isLogged() { return !!localStorage.getItem('scms_token'); },
  logout() {
    localStorage.removeItem('scms_token');
    localStorage.removeItem('scms_user');
    location.hash = '#/login';
    Router.render();
  }
};

// YAHAN FIX ADD KIYA GAYA HAI - Auth ko window par attach kar diya
window.Auth = Auth;

function renderNav() {
  const nav = document.getElementById('navMenu');
  const u = Auth.user();
  if (!u) {
    nav.innerHTML = `
      <a href="#/login">Login</a>
      <a href="#/register">Register</a>`;
    return;
  }
  const role = u.role;
  let links = `<a href="#/dashboard">Dashboard</a>`;
  if (role === 'USER') {
    links += `<a href="#/new">New Complaint</a>
              <a href="#/complaints">My Complaints</a>`;
  }
  if (role === 'STAFF') {
    links += `<a href="#/complaints">Assigned</a>`;
  }
  if (role === 'ADMIN') {
    links += `<a href="#/complaints">All Complaints</a>
              <a href="#/admin/users">Users</a>
              <a href="#/admin/departments">Departments</a>
              <a href="#/admin/analytics">Analytics</a>`;
  }
  nav.innerHTML = links + `
    <span style="opacity:.7;margin-left:12px;font-size:13px">${u.name} (${role})</span>
    <button type="button" id="logoutBtn">Logout</button>`;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());
}
