require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Health check: used to confirm the API is running
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CampusOS API',
    time: new Date().toISOString(),
  });
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
