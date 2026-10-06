const express = require('express');
const { param, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Every user sees only their own notifications
router.use(authenticate);

// GET /api/notifications: latest 30 notifications and the unread count
router.get('/', async (req, res, next) => {
  try {
    const list = await pool.query(
      `SELECT id, message, type, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 30`,
      [req.user.id]
    );
    const unread = await pool.query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ notifications: list.rows, unread: unread.rows[0].n });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/read-all: mark all of my notifications as read
router.put('/read-all', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/:id/read: mark one of my notifications as read
router.put(
  '/:id/read',
  [param('id').isInt({ min: 1 }).withMessage('Invalid notification id')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }
      // The user_id check means nobody can touch another person's notification
      const result = await pool.query(
        'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
        [Number(req.params.id), req.user.id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
