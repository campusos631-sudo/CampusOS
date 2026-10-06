const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every feedback route needs a logged-in user
router.use(authenticate);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

// POST /api/feedback: a student rates one of their own resolved complaints
router.post(
  '/',
  requireRole('student'),
  [
    body('complaint_id').isInt({ min: 1 }).withMessage('Invalid complaint').toInt(),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5').toInt(),
    body('comment').optional({ values: 'falsy' }).trim().isLength({ max: 500 }).withMessage('Comment must be 500 characters or less'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { complaint_id, rating, comment } = req.body;

      const found = await pool.query(
        'SELECT id, user_id, status FROM complaints WHERE id = $1',
        [complaint_id]
      );
      const complaint = found.rows[0];

      // A student can only rate their own complaint. Others get "not found".
      if (!complaint || complaint.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Complaint not found' });
      }
      if (complaint.status !== 'Resolved') {
        return res.status(400).json({ error: 'You can give feedback only after the complaint is resolved' });
      }

      const result = await pool.query(
        `INSERT INTO feedback (complaint_id, user_id, rating, comment)
         VALUES ($1, $2, $3, $4)
         RETURNING id, rating, comment, created_at`,
        [complaint_id, req.user.id, rating, comment || null]
      );
      res.status(201).json({ feedback: result.rows[0] });
    } catch (err) {
      // 23505 = unique violation: feedback already given for this complaint
      if (err.code === '23505') {
        return res.status(409).json({ error: 'You have already given feedback for this complaint' });
      }
      next(err);
    }
  }
);

// GET /api/feedback: admin sees all feedback with the average rating
router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const list = await pool.query(
      `SELECT f.id, f.rating, f.comment, f.created_at,
              c.ticket_id, c.title, u.name AS student_name
       FROM feedback f
       JOIN complaints c ON c.id = f.complaint_id
       JOIN users u ON u.id = f.user_id
       ORDER BY f.created_at DESC
       LIMIT 100`
    );
    const stats = await pool.query('SELECT AVG(rating) AS average, COUNT(*)::int AS count FROM feedback');

    const average = stats.rows[0].average === null ? null : Math.round(Number(stats.rows[0].average) * 10) / 10;
    res.json({ feedback: list.rows, average, count: stats.rows[0].count });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
