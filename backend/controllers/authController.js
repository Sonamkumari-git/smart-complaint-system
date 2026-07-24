const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      department_id: user.department_id || null
    },
    process.env.JWT_SECRET || 'devsecret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, password required' });
    }
    const [existing] = await db.query('SELECT id FROM users WHERE email=?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, phone, role) VALUES (?,?,?,?, "USER")',
      [name, email, hash, phone || null]
    );
    const user = { id: result.insertId, name, email, role: 'USER' };
    const token = signToken(user);
    res.status(201).json({ user, token });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const [rows] = await db.query('SELECT * FROM users WHERE email=? AND is_active=1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, department_id: user.department_id },
      token
    });
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, phone, role, department_id, created_at FROM users WHERE id=?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};
