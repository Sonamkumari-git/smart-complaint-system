const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_complaints',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

pool.getConnection()
  .then(conn => {
    console.log('[DB] MySQL connected');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] MySQL connection error:', err.message);
  });

module.exports = pool;
