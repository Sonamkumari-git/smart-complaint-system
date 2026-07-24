const db = require('../config/db');
const aiClient = require('../utils/aiClient');

// -- Helpers ---------------------------------------------------
async function recordStatus(complaintId, oldStatus, newStatus, userId, note) {
  await db.query(
    `INSERT INTO complaint_status_history
     (complaint_id, old_status, new_status, changed_by, note)
     VALUES (?,?,?,?,?)`,
    [complaintId, oldStatus, newStatus, userId || null, note || null]
  );
}

function sameId(a, b) {
  return a !== null && a !== undefined && b !== null && b !== undefined && Number(a) === Number(b);
}

function sameText(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function normalizedText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function departmentKey(value) {
  return normalizedText(value)
    .replace(/\b(department|dept|services|service|support|administration|admin)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function departmentAliases(departmentName) {
  const tokens = normalizedText(departmentName).split(' ').filter(Boolean);
  const has = token => tokens.includes(token);
  const aliases = new Set([departmentName].filter(Boolean));
  if (has('maintenance')) {
    ['Maintenance', 'General Maintenance', 'Electrical Dept', 'Electrical Department', 'Electricity'].forEach(x => aliases.add(x));
  }
  if (has('it')) {
    ['IT Support', 'IT Department', 'IT & Network Services', 'Network Services'].forEach(x => aliases.add(x));
  }
  if (has('hostel')) {
    ['Hostel Administration', 'Hostel Facilities'].forEach(x => aliases.add(x));
  }
  if (has('academic')) aliases.add('Academic Department');
  if (has('security')) aliases.add('Security Department');
  if (has('sanitation')) aliases.add('Cleaning');
  if (has('transport')) aliases.add('Transport Department');
  if (has('hr')) aliases.add('Administration');
  return [...aliases];
}

function departmentMatches(aiDepartment, departmentName) {
  const aiKey = departmentKey(aiDepartment);
  const deptKey = departmentKey(departmentName);
  if (!aiKey || !deptKey) return false;
  if (aiKey === deptKey || aiKey.includes(deptKey) || deptKey.includes(aiKey)) return true;
  return departmentAliases(departmentName).some(alias => {
    const aliasKey = departmentKey(alias);
    return aliasKey && (aiKey === aliasKey || aiKey.includes(aliasKey) || aliasKey.includes(aiKey));
  });
}

function canAccessComplaint(user, complaint) {
  if (!user || !complaint) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'USER') return sameId(complaint.user_id, user.id);
  if (user.role === 'STAFF') {
    return sameId(complaint.assigned_to, user.id) ||
      sameId(complaint.department_id, user.department_id) ||
      departmentMatches(complaint.ai_department, user.department_name);
  }
  return false;
}

async function resolveLookups(prediction) {
  // Map AI text predictions to DB rows
  const [cats] = await db.query('SELECT id, name FROM categories');
  const [prios] = await db.query('SELECT id, name FROM priorities');
  const [depts] = await db.query('SELECT id, name FROM departments');

  const find = (list, name) =>
    list.find(x => x.name.toLowerCase() === (name || '').toLowerCase()) || null;

  const department = find(depts, prediction.department) ||
    depts.find(x => departmentMatches(prediction.department, x.name)) ||
    null;

  return {
    category_id: (find(cats, prediction.category) || {}).id || null,
    priority_id: (find(prios, prediction.priority) || {}).id || null,
    department_id: (department || {}).id || null,
  };
}

// -- Endpoints -------------------------------------------------

// POST /api/complaints/predict  (preview AI prediction without saving)
exports.predictOnly = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || text.length < 5) return res.status(400).json({ error: 'text required (min 5 chars)' });
    const prediction = await aiClient.predict(text);
    res.json(prediction);
  } catch (err) { next(err); }
};

// POST /api/complaints  (create complaint, runs AI + duplicate check)
exports.create = async (req, res, next) => {
  try {
    const { title, description, location } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const image_path = req.file ? `/uploads/${req.file.filename}` : null;
    const text = `${title}. ${description}`;

    // 1. AI prediction
    const prediction = await aiClient.predict(text);

    // 2. Duplicate check against last 200 complaints of the same user or open ones
    const [recent] = await db.query(
      `SELECT id, description FROM complaints
       WHERE status NOT IN ('CLOSED','RESOLVED')
       ORDER BY created_at DESC LIMIT 200`
    );
    let duplicate_of = null;
    let similarity_score = null;
    if (recent.length) {
      const dup = await aiClient.checkDuplicate(
        text,
        recent.map(r => r.description)
      );
      if (dup.is_duplicate && dup.best_index >= 0) {
        duplicate_of = recent[dup.best_index].id;
        similarity_score = dup.best_score;
      }
    }

    const lookups = await resolveLookups(prediction);

    const [ins] = await db.query(
      `INSERT INTO complaints
        (user_id, title, description, location, image_path,
         ai_category, ai_priority, ai_department, ai_sentiment, ai_confidence,
         ai_raw_prediction, category_id, priority_id, department_id,
         duplicate_of, similarity_score, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'AI_ANALYZED')`,
      [
        req.user.id, title, description, location || null, image_path,
        prediction.category, prediction.priority, prediction.department,
        prediction.sentiment, prediction.confidence,
        JSON.stringify(prediction),
        lookups.category_id, lookups.priority_id, lookups.department_id,
        duplicate_of, similarity_score
      ]
    );
    const complaintId = ins.insertId;

    await recordStatus(complaintId, null, 'SUBMITTED', req.user.id, 'Complaint submitted by user');
    await recordStatus(complaintId, 'SUBMITTED', 'AI_ANALYZED', null,
      `AI predicted category=${prediction.category}, priority=${prediction.priority}`);

    // Log AI prediction
    await db.query(
      `INSERT INTO ai_predictions_log
       (complaint_id, input_text, category, priority, department, sentiment, confidence, latency_ms, model_version)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        complaintId, text, prediction.category, prediction.priority,
        prediction.department, prediction.sentiment, prediction.confidence,
        prediction.latency_ms || 0, prediction.model_version || 'v1'
      ]
    );

    res.status(201).json({
      id: complaintId,
      prediction,
      duplicate_of,
      similarity_score,
      status: 'AI_ANALYZED'
    });
  } catch (err) { next(err); }
};

// GET /api/complaints  (list; USER sees own, STAFF sees dept, ADMIN sees all)
exports.list = async (req, res, next) => {
  try {
    const { status, category_id, priority_id, department_id, q, page = 1, limit = 20 } = req.query;
    const filters = [];
    const params = [];

    if (req.user.role === 'USER') {
      filters.push('c.user_id = ?'); params.push(req.user.id);
    } else if (req.user.role === 'STAFF') {
      const staffFilters = ['c.assigned_to = ?'];
      params.push(req.user.id);
      if (req.user.department_id) {
        staffFilters.push('c.department_id = ?');
        params.push(req.user.department_id);
      }
      if (req.user.department_name) {
        const aliases = departmentAliases(req.user.department_name).map(x => x.toLowerCase());
        staffFilters.push(`LOWER(c.ai_department) IN (${aliases.map(() => '?').join(', ')})`);
        params.push(...aliases);
      }
      filters.push(`(${staffFilters.join(' OR ')})`);
    }
    if (status) { filters.push('c.status = ?'); params.push(status); }
    if (category_id) { filters.push('c.category_id = ?'); params.push(category_id); }
    if (priority_id) { filters.push('c.priority_id = ?'); params.push(priority_id); }
    if (department_id) { filters.push('c.department_id = ?'); params.push(department_id); }
    if (q) { filters.push('(c.title LIKE ? OR c.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

    const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT c.*,
              u.name AS user_name, u.email AS user_email,
              cat.name AS category_name,
              p.name  AS priority_name,
              d.name  AS department_name,
              a.name  AS assignee_name
       FROM complaints c
       LEFT JOIN users u ON u.id=c.user_id
       LEFT JOIN categories cat ON cat.id=c.category_id
       LEFT JOIN priorities p ON p.id=c.priority_id
       LEFT JOIN departments d ON d.id=c.department_id
       LEFT JOIN users a ON a.id=c.assigned_to
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM complaints c ${where}`, params
    );
    res.json({ total, page: parseInt(page), limit: parseInt(limit), items: rows });
  } catch (err) { next(err); }
};

// PATCH /api/complaints/:id  (USER edits own complaint details)
exports.updateOwn = async (req, res, next) => {
  try {
    const { title, description, location } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const [rows] = await db.query('SELECT id, user_id FROM complaints WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Complaint not found' });
    const c = rows[0];
    if (!sameId(c.user_id, req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.query(
      'UPDATE complaints SET title=?, description=?, location=? WHERE id=?',
      [title, description, location || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// DELETE /api/complaints/:id  (USER deletes own complaint)
exports.deleteOwn = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, user_id FROM complaints WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Complaint not found' });
    const c = rows[0];
    if (!sameId(c.user_id, req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.query('DELETE FROM complaints WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// GET /api/complaints/:id
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*,
              u.name AS user_name, u.email AS user_email,
              cat.name AS category_name,
              p.name  AS priority_name,
              d.name  AS department_name,
              a.name  AS assignee_name
       FROM complaints c
       LEFT JOIN users u ON u.id=c.user_id
       LEFT JOIN categories cat ON cat.id=c.category_id
       LEFT JOIN priorities p ON p.id=c.priority_id
       LEFT JOIN departments d ON d.id=c.department_id
       LEFT JOIN users a ON a.id=c.assigned_to
       WHERE c.id=?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Complaint not found' });
    const c = rows[0];

    // Access control
    if (!canAccessComplaint(req.user, c)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [history] = await db.query(
      `SELECT h.*, u.name AS changed_by_name
       FROM complaint_status_history h
       LEFT JOIN users u ON u.id=h.changed_by
       WHERE complaint_id=? ORDER BY h.created_at ASC`,
      [c.id]
    );
    const [comments] = await db.query(
      `SELECT cm.*, u.name AS user_name, u.role AS user_role
       FROM complaint_comments cm
       JOIN users u ON u.id=cm.user_id
       WHERE complaint_id=? ORDER BY cm.created_at ASC`,
      [c.id]
    );

    // Hide internal comments from USER
    const visibleComments = req.user.role === 'USER'
      ? comments.filter(x => !x.is_internal) : comments;

    res.json({ complaint: c, history, comments: visibleComments });
  } catch (err) { next(err); }
};

// PATCH /api/complaints/:id/status  (STAFF/ADMIN)
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, note, resolution_message } = req.body;
    const allowed = ['ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','REOPENED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const [rows] = await db.query('SELECT * FROM complaints WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Complaint not found' });
    const c = rows[0];
    if (!canAccessComplaint(req.user, c)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates = ['status=?']; const params = [status];
    if (status === 'RESOLVED') {
      updates.push('resolved_at=CURRENT_TIMESTAMP');
      if (resolution_message) { updates.push('resolution_message=?'); params.push(resolution_message); }
    }
    if (status === 'CLOSED') updates.push('closed_at=CURRENT_TIMESTAMP');

    params.push(req.params.id);
    await db.query(`UPDATE complaints SET ${updates.join(', ')} WHERE id=?`, params);
    await recordStatus(c.id, c.status, status, req.user.id, note);

    res.json({ ok: true, status });
  } catch (err) { next(err); }
};

// PATCH /api/complaints/:id/assign  (ADMIN)
exports.assign = async (req, res, next) => {
  try {
    const { assigned_to, department_id, category_id, priority_id, note } = req.body;
    const [rows] = await db.query('SELECT * FROM complaints WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Complaint not found' });
    const c = rows[0];

    const fields = []; const params = [];
    if (assigned_to !== undefined) { fields.push('assigned_to=?'); params.push(assigned_to); }
    if (department_id !== undefined) { fields.push('department_id=?'); params.push(department_id); }
    if (category_id !== undefined) { fields.push('category_id=?'); params.push(category_id); }
    if (priority_id !== undefined) { fields.push('priority_id=?'); params.push(priority_id); }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    fields.push("status='ASSIGNED'");
    params.push(req.params.id);

    await db.query(`UPDATE complaints SET ${fields.join(', ')} WHERE id=?`, params);
    await recordStatus(c.id, c.status, 'ASSIGNED', req.user.id, note || 'Assigned by admin');
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// POST /api/complaints/:id/comments
exports.addComment = async (req, res, next) => {
  try {
    const { comment, is_internal } = req.body;
    if (!comment) return res.status(400).json({ error: 'comment required' });
    const internal = !!is_internal && req.user.role !== 'USER';

    const [rows] = await db.query(
      'SELECT user_id, department_id, assigned_to, ai_department FROM complaints WHERE id=?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Complaint not found' });
    const c = rows[0];
    if (!canAccessComplaint(req.user, c)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.query(
      `INSERT INTO complaint_comments (complaint_id, user_id, comment, is_internal)
       VALUES (?,?,?,?)`,
      [req.params.id, req.user.id, comment, internal ? 1 : 0]
    );
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
};

// POST /api/complaints/:id/rate  (USER)
exports.rate = async (req, res, next) => {
  try {
    const { rating, feedback } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating 1-5 required' });

    const [rows] = await db.query('SELECT user_id, status FROM complaints WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Complaint not found' });
    const c = rows[0];
    if (c.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!['RESOLVED','CLOSED'].includes(c.status))
      return res.status(400).json({ error: 'Can only rate resolved complaints' });

    await db.query(
      'UPDATE complaints SET user_rating=?, user_feedback=? WHERE id=?',
      [rating, feedback || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// POST /api/complaints/:id/reopen  (USER)
exports.reopen = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const [rows] = await db.query('SELECT * FROM complaints WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Complaint not found' });
    const c = rows[0];
    if (c.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!['RESOLVED','CLOSED'].includes(c.status))
      return res.status(400).json({ error: 'Only resolved/closed complaints can be reopened' });

    await db.query('UPDATE complaints SET status="REOPENED" WHERE id=?', [c.id]);
    await recordStatus(c.id, c.status, 'REOPENED', req.user.id, reason || 'User not satisfied');
    res.json({ ok: true });
  } catch (err) { next(err); }
};
