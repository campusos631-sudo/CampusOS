const express = require('express');
const { body, param, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every announcement route needs a logged-in user
router.use(authenticate);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

// GET /api/announcements: everyone (student or admin) can read
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.title, a.body, a.is_important, a.created_at, u.name AS created_by_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
       ORDER BY a.created_at DESC
       LIMIT 50`
    );
    res.json({ announcements: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/announcements: admin creates an announcement and every student is notified
router.post(
  '/',
  requireRole('admin'),
  [
    body('title').trim().isLength({ min: 3, max: 150 }).withMessage('Title must be 3 to 150 characters'),
    body('body').trim().isLength({ min: 5, max: 2000 }).withMessage('Description must be 5 to 2000 characters'),
    body('is_important').optional().isBoolean().withMessage('Invalid importance value').toBoolean(),
  ],
  validate,
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { title, body: text } = req.body;
      const important = req.body.is_important === true;

      // Transaction: the announcement and all student notifications are saved together or not at all
      await client.query('BEGIN');

      const created = await client.query(
        `INSERT INTO announcements (title, body, is_important, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, body, is_important, created_at`,
        [title, text, important, req.user.id]
      );

      await client.query(
        `INSERT INTO notifications (user_id, message, type)
         SELECT id, $1, 'announcement' FROM users WHERE role = 'student'`,
        [`New announcement: ${title}`]
      );

      await client.query('COMMIT');
      res.status(201).json({ announcement: created.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  }
);

// DELETE /api/announcements/:id: admin removes an announcement
router.delete(
  '/:id',
  requireRole('admin'),
  [param('id').isInt({ min: 1 }).withMessage('Invalid announcement id')],
  validate,
  async (req, res, next) => {
    try {
      const result = await pool.query('DELETE FROM announcements WHERE id = $1', [Number(req.params.id)]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Announcement not found' });
      }
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
