const router = require('express').Router();
const db = require('../config/db');

// Non-sensitive lookup lists (for form dropdowns)
router.get('/departments', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, name FROM departments ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});
router.get('/categories', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, name FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});
router.get('/priorities', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, name, level FROM priorities ORDER BY level');
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
