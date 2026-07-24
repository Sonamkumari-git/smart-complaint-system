/**
 * Seeds the database with example users and a few complaints.
 * Run:  node utils/seed.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function upsertUser(name, email, password, role, department_id = null) {
  const [existing] = await db.query('SELECT id FROM users WHERE email=?', [email]);
  if (existing.length) return existing[0].id;
  const hash = await bcrypt.hash(password, 10);
  const [ins] = await db.query(
    'INSERT INTO users (name,email,password_hash,role,department_id) VALUES (?,?,?,?,?)',
    [name, email, hash, role, department_id]
  );
  return ins.insertId;
}

(async () => {
  try {
    const adminId = await upsertUser('Super Admin', 'admin@gmail.com', 'admin@123', 'ADMIN');
    const [[maint]] = await db.query("SELECT id FROM departments WHERE name='Maintenance'");
    const [[it]]    = await db.query("SELECT id FROM departments WHERE name='IT Support'");

    const staff1 = await upsertUser('Maint Staff', 'maint@scms.com', 'Staff@123', 'STAFF', maint.id);
    const staff2 = await upsertUser('IT Staff', 'it@scms.com', 'Staff@123', 'STAFF', it.id);

    const user1 = await upsertUser('Rahul Sharma', 'rahul@scms.com', 'User@123', 'USER');
    const user2 = await upsertUser('Priya Verma',  'priya@scms.com', 'User@123', 'USER');

    console.log('Seeded users:', { adminId, staff1, staff2, user1, user2 });
    console.log('Login credentials:');
    console.log('  ADMIN: admin@gmail.com / admin@123');
    console.log('  STAFF: maint@scms.com / Staff@123 (Maintenance)');
    console.log('  STAFF: it@scms.com    / Staff@123 (IT Support)');
    console.log('  USER : rahul@scms.com / User@123');
    console.log('  USER : priya@scms.com / User@123');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
