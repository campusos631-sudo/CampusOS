const { Pool } = require('pg');

// Connection pool: reuses database connections instead of opening a new one per request.
// The connection string comes from an environment variable, so no secret is stored in code.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  max: 5,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
});

module.exports = pool;
