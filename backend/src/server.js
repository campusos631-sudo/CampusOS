require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./config/db');

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
