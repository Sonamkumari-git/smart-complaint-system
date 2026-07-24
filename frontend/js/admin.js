const Admin = {};

Admin.dashboard = async () => {
  app().innerHTML = `
    <div class="card"><h1>Admin Dashboard</h1><p class="muted small">Live analytics and AI insights</p></div>
    <div class="grid cols-4" id="stats"></div>
    <div class="grid cols-2">
      <div class="card"><h2>Complaints by Category</h2><canvas id="catChart"></canvas></div>
      <div class="card"><h2>Complaints by Priority</h2><canvas id="prioChart"></canvas></div>
    </div>
    <div class="grid cols-2">
      <div class="card"><h2>By Department</h2><canvas id="deptChart"></canvas></div>
      <div class="card"><h2>Sentiment Distribution</h2><canvas id="sentChart"></canvas></div>
    </div>
    <div class="card"><h2>Daily Trend (last 30 days)</h2><canvas id="trendChart"></canvas></div>
    <div class="card"><h2>AI Model Performance</h2><div id="aiPerf"></div></div>`;

  try {
    const a = await API.get('/api/admin/analytics');
    const s = a.stats;
    document.getElementById('stats').innerHTML = `
      <div class="stat blue"><div class="k">Total Complaints</div><div class="v">${s.total_complaints||0}</div></div>
      <div class="stat orange"><div class="k">Open</div><div class="v">${s.open_complaints||0}</div></div>
      <div class="stat green"><div class="k">Resolved</div><div class="v">${s.resolved_complaints||0}</div></div>
      <div class="stat purple"><div class="k">Users</div><div class="v">${s.total_users||0}</div></div>`;

    barChart('catChart', a.by_category);
    donutChart('prioChart', a.by_priority);
    barChart('deptChart', a.by_department);
    donutChart('sentChart', a.by_sentiment);
    lineChart('trendChart', a.trends.map(t=>({name:t.day, count:t.count})));

    document.getElementById('aiPerf').innerHTML = `
      <div class="grid cols-3">
        <div class="stat blue"><div class="k">Total Predictions</div>
          <div class="v">${s.ai?.total_predictions||0}</div></div>
        <div class="stat green"><div class="k">Avg Confidence</div>
          <div class="v">${((s.ai?.avg_confidence||0)*100).toFixed(1)}%</div></div>
        <div class="stat orange"><div class="k">Avg Latency</div>
          <div class="v">${Math.round(s.ai?.avg_latency_ms||0)} ms</div></div>
      </div>
      <p class="small muted" style="margin-top:8px">
        Duplicate complaints detected: <b>${s.duplicate_complaints||0}</b> ·
        Avg resolution: <b>${s.avg_resolution_hours ? Math.round(s.avg_resolution_hours)+'h' : '—'}</b> ·
        Avg user rating: <b>${s.avg_rating ? Number(s.avg_rating).toFixed(2)+' / 5' : '—'}</b>
      </p>`;
  } catch (err) { toast(err.message, 'error'); }
};

Admin.users = async () => {
  app().innerHTML = `<div class="card">
    <h1>User Management</h1>
    <button class="btn" id="addBtn">+ Add Staff / Admin</button>
    <div id="addForm" class="hidden card" style="margin-top:12px">
      <h3>Create User</h3>
      <form id="frm" class="grid cols-2">
        <input name="name" placeholder="Full Name" required>
        <input name="email" type="email" placeholder="Email" required>
        <input name="password" type="password" placeholder="Password" required>
        <select name="role"><option>STAFF</option><option>ADMIN</option></select>
        <select name="department_id" id="depSel"><option value="">— department —</option></select>
        <input name="phone" placeholder="Phone (optional)">
        <button class="btn">Create</button>
      </form>
    </div>
    <div class="spacer"></div>
    <div id="userTable">Loading…</div></div>`;

  const departments = await API.get('/api/admin/departments');
  const sel = document.getElementById('depSel');
  departments.forEach(d => sel.innerHTML += `<option value="${d.id}">${d.name}</option>`);

  document.getElementById('addBtn').onclick = () =>
    document.getElementById('addForm').classList.toggle('hidden');

  document.getElementById('frm').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (d.department_id === '') delete d.department_id; else d.department_id = parseInt(d.department_id);
    try { await API.post('/api/admin/users', d); toast('Created'); Router.render(); }
    catch (err) { toast(err.message, 'error'); }
  };

  const users = await API.get('/api/admin/users');
  document.getElementById('userTable').innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Dept</th><th>Active</th><th>Created</th></tr></thead>
      <tbody>${users.map(u=>`<tr>
        <td>${u.id}</td><td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td><td>${u.role}</td>
        <td>${escapeHtml(u.department_name||'—')}</td>
        <td>${u.is_active?'✅':'❌'}</td>
        <td class="small muted">${fmtDate(u.created_at)}</td>
      </tr>`).join('')}</tbody>
    </table>`;
};

Admin.departments = async () => {
  app().innerHTML = `<div class="card">
    <h1>Departments</h1>
    <form id="frm" class="grid cols-3">
      <input name="name" placeholder="Name" required>
      <input name="contact_email" placeholder="Contact email">
      <button class="btn">Add Department</button>
    </form>
    <div class="spacer"></div>
    <div id="body">Loading…</div>
  </div>
  <div class="card">
    <h2>Categories</h2>
    <div id="catBody"></div>
  </div>`;

  document.getElementById('frm').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try { await API.post('/api/admin/departments', d); toast('Added'); Router.render(); }
    catch (err) { toast(err.message,'error'); }
  };

  const deps = await API.get('/api/admin/departments');
  document.getElementById('body').innerHTML = `
    <table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Description</th></tr></thead>
    <tbody>${deps.map(d=>`<tr><td>${d.id}</td><td>${escapeHtml(d.name)}</td>
      <td>${escapeHtml(d.contact_email||'—')}</td>
      <td>${escapeHtml(d.description||'—')}</td></tr>`).join('')}</tbody></table>`;

  const cats = await API.get('/api/admin/categories');
  document.getElementById('catBody').innerHTML = `
    <table><thead><tr><th>ID</th><th>Category</th><th>Default Dept</th></tr></thead>
    <tbody>${cats.map(c=>`<tr><td>${c.id}</td><td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.default_department_name||'—')}</td></tr>`).join('')}</tbody></table>`;
};

Admin.analytics = async () => Admin.dashboard();

// ---------- charts ----------
function barChart(id, data) {
  const ctx = document.getElementById(id);
  if (!ctx || !data) return;
  if (typeof Chart === 'undefined') return chartFallback(ctx);
  new Chart(ctx, {
    type:'bar',
    data:{
      labels: data.map(d=>d.name),
      datasets:[{ data: data.map(d=>d.count), backgroundColor:'#2563eb' }]
    },
    options:{ plugins:{ legend:{display:false} } }
  });
}
function donutChart(id, data) {
  const ctx = document.getElementById(id);
  if (!ctx || !data) return;
  if (typeof Chart === 'undefined') return chartFallback(ctx);
  new Chart(ctx, {
    type:'doughnut',
    data:{
      labels: data.map(d=>d.name),
      datasets:[{ data:data.map(d=>d.count),
        backgroundColor:['#2563eb','#7c3aed','#16a34a','#ea580c','#dc2626','#0891b2','#a855f7','#eab308'] }]
    }
  });
}
function lineChart(id, data) {
  const ctx = document.getElementById(id);
  if (!ctx || !data) return;
  if (typeof Chart === 'undefined') return chartFallback(ctx);
  new Chart(ctx, {
    type:'line',
    data:{
      labels: data.map(d=>d.name),
      datasets:[{ data:data.map(d=>d.count), borderColor:'#7c3aed', tension: 0.3, fill: false }]
    },
    options:{ plugins:{ legend:{display:false} } }
  });
}

function chartFallback(ctx) {
  const holder = ctx.parentElement;
  if (holder && !holder.querySelector('.chart-fallback')) {
    holder.insertAdjacentHTML('beforeend',
      '<p class="small muted chart-fallback">Chart library unavailable. Data cards are still shown.</p>');
  }
}
