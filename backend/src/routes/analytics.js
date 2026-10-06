const express = require('express');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Only admins can see analytics
router.use(authenticate, requireRole('admin'));

// GET /api/analytics/summary: every number is calculated from the database
router.get('/summary', async (req, res, next) => {
  try {
    const totals = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('Reported', 'Assigned'))::int AS pending,
        COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE status = 'Rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE priority IN ('High', 'Critical')
                         AND status NOT IN ('Resolved', 'Rejected'))::int AS high_priority,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
          FILTER (WHERE status = 'Resolved' AND resolved_at IS NOT NULL) AS avg_resolution_hours
      FROM complaints`);

    const byCategory = await pool.query(`
      SELECT cat.name, COUNT(c.id)::int AS count
      FROM categories cat
      LEFT JOIN complaints c ON c.category_id = cat.id
      GROUP BY cat.id, cat.name
      ORDER BY cat.id`);

    const byPriority = await pool.query(`
      SELECT p.priority, COUNT(c.id)::int AS count
      FROM (VALUES ('Low'), ('Medium'), ('High'), ('Critical')) AS p(priority)
      LEFT JOIN complaints c ON c.priority = p.priority
      GROUP BY p.priority`);

    const rating = await pool.query(
      'SELECT AVG(rating) AS average, COUNT(*)::int AS count FROM feedback'
    );

    const t = totals.rows[0];
    const avgHours = t.avg_resolution_hours === null ? null : Number(t.avg_resolution_hours);
    const average = rating.rows[0].average === null ? null : Number(rating.rows[0].average);

    res.json({
      total: t.total,
      pending: t.pending,
      in_progress: t.in_progress,
      resolved: t.resolved,
      rejected: t.rejected,
      high_priority: t.high_priority,
      resolution_rate: t.total === 0 ? 0 : Math.round((t.resolved / t.total) * 1000) / 10,
      avg_resolution_hours: avgHours === null ? null : Math.round(avgHours * 10) / 10,
      by_category: byCategory.rows,
      by_priority: byPriority.rows,
      feedback: {
        average: average === null ? null : Math.round(average * 10) / 10,
        count: rating.rows[0].count,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
