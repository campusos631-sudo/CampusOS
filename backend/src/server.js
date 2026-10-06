require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./config/db');
const { authenticate, requireRole } = require('./middleware/auth');

const app = express();
app.use(express.json());

// Health check: confirms the API is running
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CampusOS API',
    time: new Date().toISOString(),
  });
});

// Database health check: confirms the API can reach PostgreSQL
app.get('/api/health/db', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS categories FROM categories');
    res.json({ status: 'ok', database: 'connected', categories: result.rows[0].categories });
  } catch (err) {
    next(err);
  }
});

// Categories list (public reference data used by the complaint form)
app.get('/api/categories', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name FROM categories ORDER BY id');
    res.json({ categories: result.rows });
  } catch (err) {
    next(err);
  }
});

// Staff list for assigning complaints (admin only)
app.get('/api/staff', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name FROM users WHERE role = 'admin' ORDER BY name`
    );
    res.json({ staff: result.rows });
  } catch (err) {
    next(err);
  }
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/complaints', require('./routes/complaintAdmin'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/events', require('./routes/events'));

// Serve the frontend files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CampusOS server running on port ${PORT}`);
});
