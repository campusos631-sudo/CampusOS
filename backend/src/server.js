require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pool = require('./config/db');
const { authenticate, requireRole } = require('./middleware/auth');

const app = express();

// Render sits behind a proxy, so trust it to get the real client IP (needed for rate limiting)
app.set('trust proxy', 1);

// Security headers. Our pages use inline scripts/styles and Chart.js from cdnjs, so those are allowed.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
      },
    },
  })
);

// Limit request body size
app.use(express.json({ limit: '100kb' }));

// Rate limiting: slows down password guessing and fake account creation
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true, // only failed logins are counted
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed login attempts. Please try again after 15 minutes.' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this network. Please try again later.' },
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);

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
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/notifications', require('./routes/notifications'));

// Serve the frontend files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler
app.use((err, req, res, next) => {
  // Malformed JSON in the request body is a client error, not a server error
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CampusOS server running on port ${PORT}`);
});
