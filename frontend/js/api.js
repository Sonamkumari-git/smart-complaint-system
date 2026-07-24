const API = (() => {
  const BASE = ''; // same-origin: backend serves the frontend
  function token() { return localStorage.getItem('scms_token'); }

  async function request(path, opts = {}) {
    const headers = opts.headers || {};
    if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const tk = token();
    if (tk) headers['Authorization'] = 'Bearer ' + tk;

    const res = await fetch(BASE + path, { ...opts, headers });
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!res.ok) throw new Error((data && data.error) || 'Request failed');
    return data;
  }

  return {
    get:  (p)          => request(p, { method: 'GET' }),
    post: (p, body)    => request(p, { method: 'POST', body: JSON.stringify(body) }),
    patch:(p, body)    => request(p, { method: 'PATCH', body: JSON.stringify(body) }),
    del:  (p)          => request(p, { method: 'DELETE' }),
    postForm: (p, fd)  => request(p, { method: 'POST', body: fd })
  };
})();

function toast(msg, kind='success') {
  let box = document.querySelector('.toast-container');
  if (!box) { box = document.createElement('div'); box.className='toast-container'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
