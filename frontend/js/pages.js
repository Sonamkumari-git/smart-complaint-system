// UI page handlers. Registered in app.js.
const Pages = {};
const app = () => document.getElementById('app');

// ================== LOGIN ==================
Pages.login = () => {
  app().innerHTML = `
    <div class="auth-wrap">
      <div class="card">
        <h1>Login</h1>
        <p class="muted small">Access your dashboard</p>
        <form id="loginForm">
          <div class="form-row"><label>Email</label><input type="email" name="email" required></div>
          <div class="form-row"><label>Password</label><input type="password" name="password" required></div>
          <button class="btn" type="submit">Login</button>
        </form>
        <div class="hr"></div>
        <div class="small muted">
          Demo accounts (after seeding):<br>
          <b>ADMIN:</b> admin@scms.com / Admin@123 <br>
          <b>STAFF:</b> maint@scms.com / Staff@123 <br>
          <b>USER :</b> rahul@scms.com / User@123
        </div>
        <div class="spacer"></div>
        <a href="#/register">Don't have an account? Register</a>
      </div>
    </div>`;
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const res = await API.post('/api/auth/login', Object.fromEntries(f));
      Auth.save(res.user, res.token);
      toast('Welcome, ' + res.user.name);
      location.hash = '#/dashboard';
    } catch (err) { toast(err.message, 'error'); }
  };
};

// ================== REGISTER ==================
Pages.register = () => {
  app().innerHTML = `
    <div class="auth-wrap">
      <div class="card">
        <h1>Create Account</h1>
        <form id="regForm">
          <div class="form-row"><label>Full Name</label><input name="name" required></div>
          <div class="form-row"><label>Email</label><input name="email" type="email" required></div>
          <div class="form-row"><label>Phone</label><input name="phone"></div>
          <div class="form-row"><label>Password</label><input name="password" type="password" minlength="6" required></div>
          <button class="btn" type="submit">Register</button>
        </form>
        <div class="spacer"></div>
        <a href="#/login">Already have an account? Login</a>
      </div>
    </div>`;
  document.getElementById('regForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      const res = await API.post('/api/auth/register', f);
      Auth.save(res.user, res.token);
      toast('Account created');
      location.hash = '#/dashboard';
    } catch (err) { toast(err.message, 'error'); }
  };
};

// ================== DASHBOARD ==================
Pages.dashboard = async () => {
  if (!Auth.isLogged()) { location.hash = '#/login'; return; }
  const u = Auth.user();
  const role = u.role;

  if (role === 'ADMIN') return Admin.dashboard();

  app().innerHTML = `<div class="card"><h1>Welcome, ${u.name}</h1>
    <p class="muted">Role: ${role}</p></div>
    <div class="grid cols-4" id="statCards"></div>
    <div class="card"><h2>Recent Complaints</h2><div id="recentList">Loading…</div></div>`;

  try {
    const data = await API.get('/api/complaints?limit=5');
    const items = data.items;
    const total = data.total;

    const openCount = items.filter(i => !['RESOLVED','CLOSED'].includes(i.status)).length;
    const resolvedCount = items.filter(i => ['RESOLVED','CLOSED'].includes(i.status)).length;

    document.getElementById('statCards').innerHTML = `
      <div class="stat blue"><div class="k">Total (Visible)</div><div class="v">${total}</div></div>
      <div class="stat orange"><div class="k">Open (in view)</div><div class="v">${openCount}</div></div>
      <div class="stat green"><div class="k">Resolved (in view)</div><div class="v">${resolvedCount}</div></div>
      <div class="stat purple"><div class="k">Role</div><div class="v" style="font-size:18px">${role}</div></div>`;
    document.getElementById('recentList').innerHTML = renderComplaintTable(items);
  } catch (err) { toast(err.message, 'error'); }
};

// ================== NEW COMPLAINT ==================
Pages.newComplaint = async () => {
  if (Auth.role() !== 'USER') { location.hash = '#/dashboard'; return; }

  app().innerHTML = `
    <div class="card">
      <h1>Submit a New Complaint</h1>
      <p class="muted small">Our AI will analyze your complaint in real time.</p>
      <form id="complaintForm" enctype="multipart/form-data">
        <div class="form-row"><label>Title</label>
          <input name="title" required placeholder="Brief title (e.g., No water in Hostel Block B)"></div>
        <div class="form-row"><label>Description</label>
          <textarea name="description" required placeholder="Describe your issue in detail…"></textarea></div>
        <div class="form-row"><label>Location (optional)</label>
          <input name="location" placeholder="Building / Room / Address"></div>
        <div class="form-row"><label>Image (optional)</label>
          <input type="file" name="image" accept="image/*"></div>

        <div class="grid cols-2">
          <button type="button" id="btnPredict" class="btn ghost">🔍 Preview AI Analysis</button>
          <button type="submit" class="btn">Submit Complaint</button>
        </div>
      </form>
      <div class="spacer"></div>
      <div id="aiBox"></div>
    </div>`;

  document.getElementById('btnPredict').onclick = async () => {
    const desc = document.querySelector('[name=description]').value.trim();
    const title = document.querySelector('[name=title]').value.trim();
    const text = `${title}. ${desc}`.trim();
    if (text.length < 10) return toast('Please write a longer description', 'error');
    document.getElementById('aiBox').innerHTML = '<p>🤖 Analyzing…</p>';
    try {
      const p = await API.post('/api/complaints/predict', { text });
      document.getElementById('aiBox').innerHTML = renderPredictionCard(p);
    } catch (err) { toast(err.message, 'error'); }
  };

  document.getElementById('complaintForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await API.postForm('/api/complaints', fd);
      toast('Complaint submitted! ID #' + res.id);
      if (res.duplicate_of) toast('⚠ Similar complaint exists (#' + res.duplicate_of + ')', 'error');
      location.hash = '#/complaints/' + res.id;
    } catch (err) { toast(err.message, 'error'); }
  };
};

// ================== COMPLAINT LIST ==================
Pages.complaintList = async () => {
  if (!Auth.isLogged()) { location.hash = '#/login'; return; }

  app().innerHTML = `
    <div class="card">
      <h1>Complaints</h1>
      <div class="grid cols-4" style="margin-bottom:12px">
        <input id="q" placeholder="Search…"/>
        <select id="statusFilter">
          <option value="">All statuses</option>
          <option>SUBMITTED</option><option>AI_ANALYZED</option>
          <option>ASSIGNED</option><option>IN_PROGRESS</option>
          <option>RESOLVED</option><option>CLOSED</option><option>REOPENED</option>
        </select>
        <select id="priorityFilter"><option value="">All priorities</option></select>
        <button class="btn" id="btnFilter">Apply Filters</button>
      </div>
      <div id="listBody">Loading…</div>
    </div>`;

  try {
    const prios = await API.get('/api/public/priorities');
    const sel = document.getElementById('priorityFilter');
    prios.forEach(p => sel.innerHTML += `<option value="${p.id}">${p.name}</option>`);
  } catch {}

  async function load() {
    const q = document.getElementById('q').value;
    const status = document.getElementById('statusFilter').value;
    const priority = document.getElementById('priorityFilter').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (priority) params.set('priority_id', priority);
    params.set('limit', 50);
    const data = await API.get('/api/complaints?' + params.toString());
    document.getElementById('listBody').innerHTML =
      `<p class="muted small">${data.total} complaint(s)</p>` + renderComplaintTable(data.items);
  }
  document.getElementById('btnFilter').onclick = load;
  load();
};
// ================== LOGOUT ==================
Pages.logout = () => {
  // Local storage se user aur token hatao
  localStorage.clear(); // Agar aapke 'Auth' object mein clear() ya logout() function hai toh aap 'Auth.logout();' bhi likh sakte hain.
  
  toast('Logged out successfully');
  
  // Wapas login page par bhej do
  location.hash = '#/login';
};


// ================== COMPLAINT DETAIL ==================
Pages.complaintDetail = async ({ id }) => {
  if (!Auth.isLogged()) { location.hash = '#/login'; return; }
  const role = Auth.role();

  app().innerHTML = `<div class="card">Loading complaint #${id}…</div>`;
  try {
    const { complaint: c, history, comments } = await API.get('/api/complaints/' + id);

    const canManage = ['STAFF','ADMIN'].includes(role);
    const canAssign = role === 'ADMIN';
    const isOwner = role === 'USER' && c.user_id === Auth.user().id;

    app().innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap">
          <div>
            <h1>Complaint #${c.id}: ${escapeHtml(c.title)}</h1>
            <p class="muted small">Submitted by ${escapeHtml(c.user_name)} · ${fmtDate(c.created_at)}</p>
          </div>
          <div>${statusBadge(c.status)} ${priorityBadge(c.priority_name || c.ai_priority)}</div>
        </div>
        <div class="hr"></div>
        <p>${escapeHtml(c.description)}</p>
        ${c.location ? `<p><b>Location:</b> ${escapeHtml(c.location)}</p>` : ''}
        ${c.image_path ? `<p><img src="${c.image_path}" style="max-width:300px;border-radius:8px"></p>` : ''}
        ${c.duplicate_of ? `<p class="badge critical">Possible duplicate of #${c.duplicate_of} (similarity: ${(c.similarity_score*100).toFixed(0)}%)</p>` : ''}
      </div>

      ${isOwner ? renderUserComplaintActions(c) : ''}

      <div class="grid cols-2">
        <div class="card">
          <h2>AI Prediction</h2>
          ${renderPredictionCard({
            category: c.ai_category, priority: c.ai_priority,
            department: c.ai_department, sentiment: c.ai_sentiment,
            confidence: parseFloat(c.ai_confidence || 0)
          })}
          <div class="hr"></div>
          <p><b>Final assignment</b></p>
          <p class="small muted">
            Category: ${c.category_name || '—'} · Priority: ${c.priority_name || '—'} ·
            Department: ${c.department_name || '—'} · Assignee: ${c.assignee_name || '—'}
          </p>
        </div>
        <div class="card">
          <h2>Status Timeline</h2>
          <div class="timeline">
            ${history.map(h => `
              <div class="step">
                <div class="t">${fmtDate(h.created_at)} — ${escapeHtml(h.changed_by_name || 'system')}</div>
                <div class="msg">
                  ${h.old_status ? `<span class="muted small">${h.old_status} →</span>` : ''}
                  ${statusBadge(h.new_status)}
                </div>
                ${h.note ? `<div class="small">${escapeHtml(h.note)}</div>` : ''}
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Comments</h2>
        <div id="commentsBox">
          ${comments.map(cm => `
            <div class="comment ${cm.is_internal ? 'internal':''}">
              <div class="who"><b>${escapeHtml(cm.user_name)}</b> (${cm.user_role})
                ${cm.is_internal ? '· <span class="badge">INTERNAL</span>' : ''}
                · ${fmtDate(cm.created_at)}</div>
              <div>${escapeHtml(cm.comment)}</div>
            </div>`).join('') || '<p class="muted small">No comments yet.</p>'}
        </div>
        <form id="commentForm" style="margin-top:12px">
          <textarea name="comment" required placeholder="Write a comment…"></textarea>
          ${canManage ? '<label><input type="checkbox" name="is_internal"> Internal note (not visible to user)</label>' : ''}
          <div class="spacer"></div>
          <button class="btn">Add Comment</button>
        </form>
      </div>

      ${canManage ? renderStaffActions(c) : ''}
      ${canAssign ? await renderAdminAssign(c) : ''}
      ${isOwner && ['RESOLVED','CLOSED'].includes(c.status) ? renderUserFeedback(c) : ''}
    `;

    document.getElementById('commentForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try {
        await API.post(`/api/complaints/${id}/comments`, {
          comment: f.comment, is_internal: !!f.is_internal
        });
        toast('Comment added'); Router.render();
      } catch (err) { toast(err.message, 'error'); }
    };

    bindDetailActions(c, id);
  } catch (err) { toast(err.message, 'error'); }
};

function renderStaffActions(c) {
  const opts = ['ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED']
    .filter(s => s !== c.status)
    .map(s => `<option>${s}</option>`).join('');
  return `
    <div class="card">
      <h2>Staff Actions</h2>
      <div class="grid cols-2">
        <button type="button" class="btn warn" id="pendingBtn">Mark Pending</button>
        <button type="button" class="btn success" id="resolvedBtn">Mark Resolved</button>
      </div>
      <div class="spacer"></div>
      <form id="statusForm" class="grid cols-3">
        <select name="status">${opts}</select>
        <input name="note" placeholder="Note (optional)">
        <button class="btn">Update Status</button>
      </form>
      <div class="spacer"></div>
      <form id="resolveForm">
        <textarea name="resolution_message" placeholder="Resolution message (only for RESOLVED)"></textarea>
        <div class="small muted">Fill this to send resolution details to user.</div>
      </form>
    </div>`;
}

function renderUserComplaintActions(c) {
  return `
    <div class="card">
      <h2>Your Complaint Actions</h2>
      <div class="grid cols-2">
        <button type="button" class="btn ghost" id="editComplaintBtn">Edit Complaint</button>
        <button type="button" class="btn danger" id="deleteComplaintBtn">Delete Complaint</button>
      </div>
      <form id="editComplaintForm" class="hidden" style="margin-top:12px">
        <div class="form-row"><label>Title</label>
          <input name="title" value="${escapeAttr(c.title)}" required></div>
        <div class="form-row"><label>Description</label>
          <textarea name="description" required>${escapeHtml(c.description)}</textarea></div>
        <div class="form-row"><label>Location</label>
          <input name="location" value="${escapeAttr(c.location || '')}"></div>
        <button class="btn">Save Changes</button>
      </form>
    </div>`;
}

async function renderAdminAssign(c) {
  let staff = [], departments = [], categories = [], priorities = [];
  try {
    staff = await API.get('/api/admin/users');
    departments = await API.get('/api/public/departments');
    categories = await API.get('/api/public/categories');
    priorities = await API.get('/api/public/priorities');
  } catch {}
  return `
    <div class="card">
      <h2>Admin Assignment</h2>
      <form id="assignForm" class="grid cols-2">
        <div class="form-row"><label>Department</label>
          <select name="department_id">
            <option value="">—</option>
            ${departments.map(d => `<option value="${d.id}" ${d.id===c.department_id?'selected':''}>${d.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Category</label>
          <select name="category_id">
            <option value="">—</option>
            ${categories.map(x => `<option value="${x.id}" ${x.id===c.category_id?'selected':''}>${x.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Priority</label>
          <select name="priority_id">
            <option value="">—</option>
            ${priorities.map(x => `<option value="${x.id}" ${x.id===c.priority_id?'selected':''}>${x.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Assign to (Staff)</label>
          <select name="assigned_to">
            <option value="">—</option>
            ${staff.filter(s=>s.role==='STAFF').map(s=>`<option value="${s.id}" ${s.id===c.assigned_to?'selected':''}>${s.name} (${s.department_name||''})</option>`).join('')}
          </select>
        </div>
        <button class="btn">Save Assignment</button>
      </form>
    </div>`;
}

function renderUserFeedback(c) {
  return `
    <div class="card">
      <h2>Your Feedback</h2>
      ${c.user_rating ? `<p>You rated this ${'★'.repeat(c.user_rating)}${'☆'.repeat(5-c.user_rating)}</p>` :
        `<form id="rateForm">
          <div id="starPicker" class="stars">☆☆☆☆☆</div>
          <input type="hidden" name="rating" id="ratingVal">
          <textarea name="feedback" placeholder="Optional feedback"></textarea>
          <button class="btn success">Submit Rating</button>
        </form>`}
      <form id="reopenForm" style="margin-top:12px">
        <input name="reason" placeholder="Why are you reopening?">
        <button class="btn warn">Reopen Complaint</button>
      </form>
    </div>`;
}

function bindDetailActions(c, id) {
  const editBtn = document.getElementById('editComplaintBtn');
  const editForm = document.getElementById('editComplaintForm');
  if (editBtn && editForm) {
    editBtn.onclick = () => editForm.classList.toggle('hidden');
    editForm.onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      try {
        await API.patch(`/api/complaints/${id}`, data);
        toast('Complaint updated'); Router.render();
      } catch (err) { toast(err.message, 'error'); }
    };
  }

  const delBtn = document.getElementById('deleteComplaintBtn');
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm('Delete this complaint?')) return;
    try {
      await API.del(`/api/complaints/${id}`);
      toast('Complaint deleted');
      location.hash = '#/complaints';
    } catch (err) { toast(err.message, 'error'); }
  };

  const pendingBtn = document.getElementById('pendingBtn');
  if (pendingBtn) pendingBtn.onclick = async () => {
    try {
      await API.patch(`/api/complaints/${id}/status`, {
        status: 'ASSIGNED',
        note: 'Marked as pending'
      });
      toast('Marked pending'); Router.render();
    } catch (err) { toast(err.message, 'error'); }
  };

  const resolvedBtn = document.getElementById('resolvedBtn');
  if (resolvedBtn) resolvedBtn.onclick = async () => {
    const resolutionMsg = document.querySelector('[name=resolution_message]')?.value;
    try {
      await API.patch(`/api/complaints/${id}/status`, {
        status: 'RESOLVED',
        note: 'Marked as resolved',
        resolution_message: resolutionMsg
      });
      toast('Marked resolved'); Router.render();
    } catch (err) { toast(err.message, 'error'); }
  };

  const f = document.getElementById('statusForm');
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const resolutionMsg = document.querySelector('[name=resolution_message]')?.value;
    try {
      await API.patch(`/api/complaints/${id}/status`, { ...data, resolution_message: resolutionMsg });
      toast('Status updated'); Router.render();
    } catch (err) { toast(err.message, 'error'); }
  };
  const af = document.getElementById('assignForm');
  if (af) af.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    ['department_id','category_id','priority_id','assigned_to'].forEach(k => {
      if (data[k] === '') delete data[k]; else data[k] = parseInt(data[k]);
    });
    try {
      await API.patch(`/api/complaints/${id}/assign`, data);
      toast('Assigned'); Router.render();
    } catch (err) { toast(err.message, 'error'); }
  };

  const picker = document.getElementById('starPicker');
  if (picker) {
    picker.onclick = (e) => {
      const rect = picker.getBoundingClientRect();
      const rel = e.clientX - rect.left;
      const val = Math.max(1, Math.min(5, Math.round(rel / (rect.width/5))));
      picker.textContent = '★'.repeat(val) + '☆'.repeat(5-val);
      document.getElementById('ratingVal').value = val;
    };
  }
  const rf = document.getElementById('rateForm');
  if (rf) rf.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (!data.rating) return toast('Choose a rating first','error');
    try {
      await API.post(`/api/complaints/${id}/rate`, { rating: parseInt(data.rating), feedback: data.feedback });
      toast('Thanks for your feedback'); Router.render();
    } catch (err) { toast(err.message, 'error'); }
  };
  const rof = document.getElementById('reopenForm');
  if (rof) rof.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await API.post(`/api/complaints/${id}/reopen`, data);
      toast('Complaint reopened'); Router.render();
    } catch (err) { toast(err.message, 'error'); }
  };
}

// ============ helpers ============
function renderPredictionCard(p) {
  const conf = Math.round((p.confidence || 0) * 100);
  return `
    <div class="ai-preview">
      <h3>AI Analysis</h3>
      <div class="row"><span class="label">Category</span><span class="val">${escapeHtml(p.category||'—')}</span></div>
      <div class="row"><span class="label">Priority</span><span class="val">${priorityBadge(p.priority)}</span></div>
      <div class="row"><span class="label">Department</span><span class="val">${escapeHtml(p.department||'—')}</span></div>
      <div class="row"><span class="label">Sentiment</span><span class="val">${sentimentBadge(p.sentiment)}</span></div>
      <div class="row"><span class="label">Confidence</span>
        <span class="val" style="min-width:120px">
          ${conf}%
          <div class="progress"><div style="width:${conf}%"></div></div>
        </span>
      </div>
      ${p.fallback ? '<p class="small" style="color:#b91c1c">⚠ AI service unavailable — fallback prediction shown.</p>' : ''}
    </div>`;
}

function renderComplaintTable(items) {
  if (!items || !items.length) return '<p class="muted small">No complaints found.</p>';
  return `
    <table>
      <thead><tr>
        <th>#</th><th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>Dept</th><th>Created</th><th></th>
      </tr></thead>
      <tbody>
        ${items.map(c => `
          <tr>
            <td>${c.id}</td>
            <td>${escapeHtml(c.title)}</td>
            <td>${escapeHtml(c.category_name || c.ai_category || '—')}</td>
            <td>${priorityBadge(c.priority_name || c.ai_priority)}</td>
            <td>${statusBadge(c.status)}</td>
            <td>${escapeHtml(c.department_name || c.ai_department || '—')}</td>
            <td class="small muted">${fmtDate(c.created_at)}</td>
            <td><a href="#/complaints/${c.id}">Open →</a></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function statusBadge(s) {
  const cls = 'status-' + String(s||'').toLowerCase();
  return `<span class="badge ${cls}">${s}</span>`;
}
function priorityBadge(p) {
  if (!p) return '—';
  return `<span class="badge ${p.toLowerCase()}">${p}</span>`;
}
function sentimentBadge(s) {
  if (!s) return '—';
  return `<span class="badge ${s.toLowerCase()}">${s}</span>`;
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString();
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/`/g, '&#96;');
}
