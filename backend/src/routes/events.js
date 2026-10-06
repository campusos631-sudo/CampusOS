const express = require('express');
const { body, param, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every event route needs a logged-in user
router.use(authenticate);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

const idRule = param('id').isInt({ min: 1 }).withMessage('Invalid event id');

// GET /api/events: all events with registration count and "am I registered" flag
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.title, e.description,
              to_char(e.event_date, 'YYYY-MM-DD') AS event_date,
              to_char(e.event_time, 'HH24:MI') AS event_time,
              e.location, e.capacity,
              (SELECT COUNT(*)::int FROM event_registrations r WHERE r.event_id = e.id) AS registered,
              EXISTS (SELECT 1 FROM event_registrations r
                      WHERE r.event_id = e.id AND r.user_id = $1) AS is_registered,
              (e.event_date < CURRENT_DATE) AS is_past
       FROM events e
       ORDER BY e.event_date ASC, e.event_time ASC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ events: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/events: admin creates an event
router.post(
  '/',
  requireRole('admin'),
  [
    body('title').trim().isLength({ min: 3, max: 150 }).withMessage('Title must be 3 to 150 characters'),
    body('description').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }).withMessage('Description is too long'),
    body('event_date')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Select a valid date')
      .isISO8601({ strict: true }).withMessage('Select a valid date'),
    body('event_time').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Select a valid time'),
    body('location').trim().isLength({ min: 2, max: 150 }).withMessage('Location must be 2 to 150 characters'),
    body('capacity').isInt({ min: 1, max: 10000 }).withMessage('Capacity must be between 1 and 10000').toInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, description, event_date, event_time, location, capacity } = req.body;
      const result = await pool.query(
        `INSERT INTO events (title, description, event_date, event_time, location, capacity, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, title`,
        [title, description || null, event_date, event_time, location, capacity, req.user.id]
      );
      res.status(201).json({ event: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/events/:id: admin deletes an event (its registrations are deleted automatically)
router.delete('/:id', requireRole('admin'), [idRule], validate, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM events WHERE id = $1', [Number(req.params.id)]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/register: a student registers for an event
router.post('/:id/register', requireRole('student'), [idRule], validate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the event row so two students cannot take the last seat at the same time
    const found = await client.query(
      `SELECT id, title, capacity, (event_date < CURRENT_DATE) AS is_past
       FROM events WHERE id = $1 FOR UPDATE`,
      [Number(req.params.id)]
    );
    const event = found.rows[0];

    if (!event) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.is_past) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This event has already taken place' });
    }

    const count = await client.query(
      'SELECT COUNT(*)::int AS n FROM event_registrations WHERE event_id = $1',
      [event.id]
    );
    if (count.rows[0].n >= event.capacity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Sorry, this event is full' });
    }

    await client.query(
      'INSERT INTO event_registrations (event_id, user_id) VALUES ($1, $2)',
      [event.id, req.user.id]
    );
    await client.query(
      `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'event_registration')`,
      [req.user.id, `You are registered for "${event.title}".`]
    );

    await client.query('COMMIT');
    res.status(201).json({ registered: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // 23505 = unique violation: this student is already registered
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You are already registered for this event' });
    }
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /api/events/:id/register: a student cancels their registration
router.delete('/:id/register', requireRole('student'), [idRule], validate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM event_registrations WHERE event_id = $1 AND user_id = $2',
      [Number(req.params.id), req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'You are not registered for this event' });
    }
    res.json({ cancelled: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id/registrations: admin sees the participant list
router.get('/:id/registrations', requireRole('admin'), [idRule], validate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.name, u.email, u.enrollment_no, u.department, u.semester, r.registered_at
       FROM event_registrations r
       JOIN users u ON u.id = r.user_id
       WHERE r.event_id = $1
       ORDER BY r.registered_at ASC`,
      [Number(req.params.id)]
    );
    res.json({ registrations: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
