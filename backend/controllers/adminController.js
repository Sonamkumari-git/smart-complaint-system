const db = require('../config/db');
const bcrypt = require('bcryptjs');
const aiClient = require('../utils/aiClient');

// ---------- Users ----------
exports.listUsers = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.is_active,
              u.department_id, d.name AS department_name, u.created_at
       FROM users u LEFT JOIN departments d ON d.id=u.department_id
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createStaff = async (req, res, next) => {
  try {
    const { name, email, password, role, department_id, phone } = req.body;
    if (!name || !email || !password || !role)
      return res.status(400).json({ error: 'name,email,password,role required' });
    if (!['STAFF','ADMIN'].includes(role))
      return res.status(400).json({ error: 'role must be STAFF or ADMIN' });

    const [existing] = await db.query('SELECT id FROM users WHERE email=?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const [ins] = await db.query(
      'INSERT INTO users (name, email, password_hash, phone, role, department_id) VALUES (?,?,?,?,?,?)',
      [name, email, hash, phone || null, role, department_id || null]
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { name, role, department_id, is_active, phone } = req.body;
    const fields = []; const params = [];
    if (name !== undefined) { fields.push('name=?'); params.push(name); }
    if (role !== undefined) { fields.push('role=?'); params.push(role); }
    if (department_id !== undefined) { fields.push('department_id=?'); params.push(department_id); }
    if (is_active !== undefined) { fields.push('is_active=?'); params.push(is_active ? 1 : 0); }
    if (phone !== undefined) { fields.push('phone=?'); params.push(phone); }
    if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
    params.push(req.params.id);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id=?`, params);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ---------- Departments ----------
exports.listDepartments = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM departments ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
};
exports.createDepartment = async (req, res, next) => {
  try {
    const { name, description, contact_email } = req.body;
    const [ins] = await db.query(
      'INSERT INTO departments (name, description, contact_email) VALUES (?,?,?)',
      [name, description || null, contact_email || null]
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) { next(err); }
};

// ---------- Categories & Priorities ----------
exports.listCategories = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, d.name AS default_department_name
       FROM categories c LEFT JOIN departments d ON d.id=c.default_department_id ORDER BY c.name`
    );
    res.json(rows);
  } catch (err) { next(err); }
};
exports.createCategory = async (req, res, next) => {
  try {
    const { name, default_department_id, description } = req.body;
    const [ins] = await db.query(
      'INSERT INTO categories (name, default_department_id, description) VALUES (?,?,?)',
      [name, default_department_id || null, description || null]
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) { next(err); }
};
exports.listPriorities = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM priorities ORDER BY level');
    res.json(rows);
  } catch (err) { next(err); }
};

// ---------- Analytics ----------
exports.analytics = async (req, res, next) => {
  try {
    const [statusCounts] = await db.query(
      'SELECT status, COUNT(*) AS count FROM complaints GROUP BY status'
    );
    const [byCategory] = await db.query(
      `SELECT COALESCE(cat.name, c.ai_category, 'Unclassified') AS name, COUNT(*) AS count
       FROM complaints c LEFT JOIN categories cat ON cat.id=c.category_id
       GROUP BY name ORDER BY count DESC LIMIT 10`
    );
    const [byPriority] = await db.query(
      `SELECT COALESCE(p.name, c.ai_priority, 'Unknown') AS name, COUNT(*) AS count
       FROM complaints c LEFT JOIN priorities p ON p.id=c.priority_id
       GROUP BY name ORDER BY count DESC`
    );
    const [byDepartment] = await db.query(
      `SELECT COALESCE(d.name, c.ai_department, 'Unassigned') AS name, COUNT(*) AS count
       FROM complaints c LEFT JOIN departments d ON d.id=c.department_id
       GROUP BY name ORDER BY count DESC`
    );
    const [sentiment] = await db.query(
      'SELECT ai_sentiment AS name, COUNT(*) AS count FROM complaints GROUP BY ai_sentiment'
    );
    const [trends] = await db.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count
       FROM complaints WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY day ORDER BY day`
    );
    const [[stats]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM complaints) AS total_complaints,
         (SELECT COUNT(*) FROM complaints WHERE status IN ('SUBMITTED','AI_ANALYZED','CLASSIFIED','ASSIGNED','IN_PROGRESS','REOPENED')) AS open_complaints,
         (SELECT COUNT(*) FROM complaints WHERE status IN ('RESOLVED','CLOSED')) AS resolved_complaints,
         (SELECT COUNT(*) FROM users WHERE role='USER') AS total_users,
         (SELECT AVG(user_rating) FROM complaints WHERE user_rating IS NOT NULL) AS avg_rating,
         (SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at))
            FROM complaints WHERE resolved_at IS NOT NULL) AS avg_resolution_hours`
    );
    const [aiStats] = await db.query(
      `SELECT AVG(confidence) AS avg_confidence, AVG(latency_ms) AS avg_latency_ms,
              COUNT(*) AS total_predictions
       FROM ai_predictions_log`
    );
    const [duplicates] = await db.query(
      'SELECT COUNT(*) AS duplicates FROM complaints WHERE duplicate_of IS NOT NULL'
    );

    res.json({
      stats: {
        ...stats,
        duplicate_complaints: duplicates[0].duplicates,
        ai: aiStats[0]
      },
      status_counts: statusCounts,
      by_category: byCategory,
      by_priority: byPriority,
      by_department: byDepartment,
      by_sentiment: sentiment,
      trends
    });
  } catch (err) { next(err); }
};

// ---------- AI service health passthrough ----------
exports.aiHealth = async (req, res, next) => {
  try { res.json(await aiClient.health()); }
  catch (err) { next(err); }
};
