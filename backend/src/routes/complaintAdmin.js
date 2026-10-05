const express = require('express');
const { body, param, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Only logged-in admins can use these routes
router.use(authenticate, requireRole('admin'));

const STATUSES = ['Reported', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

const idRule = param('id').isInt({ min: 1 }).withMessage('Invalid complaint id');

// Runs "work" inside a transaction on a locked complaint row.
// If anything fails, every change is rolled back.
async function updateComplaint(req, res, next, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query(
      `SELECT id, ticket_id, user_id, status, priority, assigned_to
       FROM complaints WHERE id = $1 FOR UPDATE`,
      [Number(req.params.id)]
    );
    const complaint = found.rows[0];

    if (!complaint) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Complaint not found' });
    }
    if (complaint.status === 'Resolved' || complaint.status === 'Rejected') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This complaint is already closed' });
    }

    const result = await work(client, complaint);
    if (result && result.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: result.error });
    }

    await client.query('COMMIT');
    res.json(result);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

// PUT /api/complaints/:id/status: change the complaint status
router.put(
  '/:id/status',
  [
    idRule,
    body('status').isIn(STATUSES).withMessage('Invalid status'),
    body('note').optional({ values: 'falsy' }).trim().isLength({ max: 500 }).withMessage('Note is too long'),
  ],
  validate,
  (req, res, next) =>
    updateComplaint(req, res, next, async (client, c) => {
      const { status } = req.body;
      if (status === c.status) return { error: 'Complaint is already in this status' };

      const note = req.body.note || `Status changed to ${status}`;
      const resolvedAt = status === 'Resolved' ? new Date() : null;

      await client.query(
        'UPDATE complaints SET status = $1, resolved_at = $2 WHERE id = $3',
        [status, resolvedAt, c.id]
      );
      await client.query(
        `INSERT INTO complaint_updates (complaint_id, status, note, updated_by)
         VALUES ($1, $2, $3, $4)`,
        [c.id, status, note, req.user.id]
      );

      const message =
        status === 'Resolved'
          ? `Your complaint ${c.ticket_id} has been resolved. Please give your feedback.`
          : `Your complaint ${c.ticket_id} is now "${status}".`;
      await client.query(
        `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'complaint_status')`,
        [c.user_id, message]
      );

      return { complaint: { id: c.id, ticket_id: c.ticket_id, status, resolved_at: resolvedAt } };
    })
);

// PUT /api/complaints/:id/assign: assign the complaint to an admin/staff member
router.put(
  '/:id/assign',
  [idRule, body('assigned_to').isInt({ min: 1 }).withMessage('Select a staff member')],
  validate,
  (req, res, next) =>
    updateComplaint(req, res, next, async (client, c) => {
      const staff = await client.query(
        `SELECT id, name FROM users WHERE id = $1 AND role = 'admin'`,
        [Number(req.body.assigned_to)]
      );
      if (staff.rows.length === 0) return { error: 'Selected staff member not found' };
      const person = staff.rows[0];

      // A newly reported complaint moves to "Assigned". Other statuses stay as they are.
      const newStatus = c.status === 'Reported' ? 'Assigned' : c.status;

      await client.query(
        'UPDATE complaints SET assigned_to = $1, status = $2 WHERE id = $3',
        [person.id, newStatus, c.id]
      );
      await client.query(
        `INSERT INTO complaint_updates (complaint_id, status, note, updated_by)
         VALUES ($1, $2, $3, $4)`,
        [c.id, newStatus, `Assigned to ${person.name}`, req.user.id]
      );
      await client.query(
        `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'complaint_assigned')`,
        [c.user_id, `Your complaint ${c.ticket_id} has been assigned to ${person.name}.`]
      );

      return {
        complaint: { id: c.id, ticket_id: c.ticket_id, status: newStatus, assigned_to_name: person.name },
      };
    })
);

// PUT /api/complaints/:id/priority: change the priority
router.put(
  '/:id/priority',
  [idRule, body('priority').isIn(PRIORITIES).withMessage('Invalid priority')],
  validate,
  (req, res, next) =>
    updateComplaint(req, res, next, async (client, c) => {
      const { priority } = req.body;
      if (priority === c.priority) return { error: 'Complaint already has this priority' };

      await client.query('UPDATE complaints SET priority = $1 WHERE id = $2', [priority, c.id]);
      await client.query(
        `INSERT INTO complaint_updates (complaint_id, status, note, updated_by)
         VALUES ($1, $2, $3, $4)`,
        [c.id, c.status, `Priority changed from ${c.priority} to ${priority}`, req.user.id]
      );

      return { complaint: { id: c.id, ticket_id: c.ticket_id, priority } };
    })
);

module.exports = router;
