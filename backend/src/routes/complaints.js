const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every complaint route needs a logged-in user
router.use(authenticate);

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Reported', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

const createRules = [
  body('category_id').isInt({ min: 1 }).withMessage('Select a category'),
  body('title').trim().isLength({ min: 5, max: 150 }).withMessage('Title must be 5 to 150 characters'),
  body('description').trim().isLength({ min: 10, max: 2000 }).withMessage('Description must be 10 to 2000 characters'),
  body('priority').optional({ values: 'falsy' }).isIn(PRIORITIES).withMessage('Invalid priority'),
];

const listRules = [
  query('q').optional().isString().isLength({ max: 100 }).withMessage('Search text is too long'),
  query('status').optional({ values: 'falsy' }).isIn(STATUSES).withMessage('Invalid status'),
  query('priority').optional({ values: 'falsy' }).isIn(PRIORITIES).withMessage('Invalid priority'),
  query('category_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Invalid category'),
];

const idRules = [param('id').isInt({ min: 1 }).withMessage('Invalid complaint id')];

// POST /api/complaints: a student or teacher submits a new complaint
router.post('/', requireRole('student', 'teacher'), createRules, validate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { category_id, title, description } = req.body;
    const priority = req.body.priority || 'Medium';

    // Transaction: complaint, first timeline entry and notification are saved together or not at all
    await client.query('BEGIN');

    const created = await client.query(
      `INSERT INTO complaints (user_id, category_id, title, description, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, ticket_id, title, priority, status, created_at`,
      [req.user.id, category_id, title, description, priority]
    );
    const complaint = created.rows[0];

    await client.query(
      `INSERT INTO complaint_updates (complaint_id, status, note, updated_by)
       VALUES ($1, 'Reported', 'Complaint submitted', $2)`,
      [complaint.id, req.user.id]
    );

    await client.query(
      `INSERT INTO notifications (user_id, message, type)
       VALUES ($1, $2, 'complaint_submitted')`,
      [req.user.id, `Your complaint ${complaint.ticket_id} has been submitted.`]
    );

    await client.query('COMMIT');
    res.status(201).json({ complaint });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Selected category does not exist' });
    }
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/complaints: students and teachers see their own, admins see all (with search and filters)
router.get('/', listRules, validate, async (req, res, next) => {
  try {
    const params = [];
    const where = [];

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      where.push(`c.user_id = $${params.length}`);
    }

    const { q, status, priority, category_id } = req.query;
    if (q) {
      params.push(`%${q}%`);
      where.push(`(c.title ILIKE $${params.length} OR c.ticket_id ILIKE $${params.length})`);
    }
    if (status) {
      params.push(status);
      where.push(`c.status = $${params.length}`);
    }
    if (priority) {
      params.push(priority);
      where.push(`c.priority = $${params.length}`);
    }
    if (category_id) {
      params.push(Number(category_id));
      where.push(`c.category_id = $${params.length}`);
    }

    const sql = `
      SELECT c.id, c.ticket_id, c.title, c.priority, c.status, c.created_at, c.resolved_at,
             cat.name AS category, u.name AS student_name, a.name AS assigned_to_name
      FROM complaints c
      JOIN categories cat ON cat.id = c.category_id
      JOIN users u ON u.id = c.user_id
      LEFT JOIN users a ON a.id = c.assigned_to
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY c.created_at DESC
      LIMIT 100`;

    const result = await pool.query(sql, params);
    res.json({ complaints: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/:id: one complaint with its status timeline and feedback
router.get('/:id', idRules, validate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const found = await pool.query(
      `SELECT c.id, c.ticket_id, c.title, c.description, c.priority, c.status, c.image_url,
              c.created_at, c.resolved_at, c.user_id,
              cat.name AS category, u.name AS student_name, a.name AS assigned_to_name
       FROM complaints c
       JOIN categories cat ON cat.id = c.category_id
       JOIN users u ON u.id = c.user_id
       LEFT JOIN users a ON a.id = c.assigned_to
       WHERE c.id = $1`,
      [id]
    );

    const complaint = found.rows[0];
    // Only the owner or an admin can open a complaint. Others get "not found".
    if (!complaint || (req.user.role !== 'admin' && complaint.user_id !== req.user.id)) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const timeline = await pool.query(
      `SELECT cu.status, cu.note, cu.created_at, u.name AS updated_by_name
       FROM complaint_updates cu
       LEFT JOIN users u ON u.id = cu.updated_by
       WHERE cu.complaint_id = $1
       ORDER BY cu.created_at ASC, cu.id ASC`,
      [id]
    );

    const feedback = await pool.query(
      'SELECT rating, comment, created_at FROM feedback WHERE complaint_id = $1',
      [id]
    );

    res.json({
      complaint,
      timeline: timeline.rows,
      feedback: feedback.rows[0] || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
