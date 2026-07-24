const Router = {
  routes: {},
  add(path, handler) { this.routes[path] = handler; },
  render() {
    renderNav();
    const hash = location.hash.replace('#','') || (Auth.isLogged() ? '/dashboard' : '/login');
    // Match dynamic routes /complaints/:id
    for (const path of Object.keys(this.routes)) {
      const params = matchPath(path, hash);
      if (params) return this.routes[path](params);
    }
    document.getElementById('app').innerHTML = '<div class="card"><h1>404</h1><p>Page not found.</p></div>';
  }
};

function matchPath(pattern, actual) {
  const p = pattern.split('/').filter(Boolean);
  const a = actual.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params = {};
  for (let i=0; i<p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

window.addEventListener('hashchange', () => Router.render());
window.addEventListener('load', () => Router.render());
