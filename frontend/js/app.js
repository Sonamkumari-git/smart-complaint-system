// Register routes
Router.add('/login',                     Pages.login);
Router.add('/register',                  Pages.register);
Router.add('/dashboard',                 Pages.dashboard);
Router.add('/new',                       Pages.newComplaint);
Router.add('/complaints',                Pages.complaintList);
Router.add('/complaints/:id',            Pages.complaintDetail);
Router.add('/admin/users',               Admin.users);
Router.add('/admin/departments',         Admin.departments);
Router.add('/admin/analytics',           Admin.analytics);
// YAHAN FIX ADD KIYA GAYA HAI - Logout route register kar diya
Router.add('/logout',                    () => Auth.logout());

// Poll AI service health
async function pollAiStatus() {
  const el = document.getElementById('aiStatus');
  if (!Auth.isLogged() || Auth.role() !== 'ADMIN') { el.textContent = ''; return; }
  try {
    const h = await API.get('/api/admin/ai-health');
    if (h.status === 'ok') {
      el.textContent = `AI: ONLINE · ${h.model_version || ''}`;
      el.className = 'ai-status up';
    } else {
      el.textContent = 'AI: OFFLINE';
      el.className = 'ai-status down';
    }
  } catch {
    el.textContent = 'AI: —';
    el.className = 'ai-status';
  }
}
setInterval(pollAiStatus, 15000);
window.addEventListener('load', pollAiStatus);
