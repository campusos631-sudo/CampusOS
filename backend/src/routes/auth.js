const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Create a signed JWT that carries only the user id and role
function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

// Reads validation results and stops the request if any rule failed
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

const registerRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2 to 100 characters'),
  body('email').trim().toLowerCase().isEmail().withMessage('Enter a valid email address'),
  body('password')
    .isLength({ min: 8, max: 72 }).withMessage('Password must be 8 to 72 characters')
    .matches(/[A-Za-z]/).withMessage('Password must contain a letter')
    .matches(/\d/).withMessage('Password must contain a number'),
  body('enrollment_no').optional({ values: 'falsy' }).trim().isLength({ max: 30 }).withMessage('Enrollment number is too long'),
  body('department').optional({ values: 'falsy' }).trim().isLength({ max: 80 }).withMessage('Department name is too long'),
  body('semester').optional({ values: 'falsy' }).isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8'),
];

const loginRules = [
  body('email').trim().toLowerCase().isEmail().withMessage('Enter a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
];

// POST /api/auth/register: creates a student account
router.post('/register', registerRules, validate, async (req, res, next) => {
  try {
    const { name, email, password, enrollment_no, department, semester } = req.body;

    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Password is hashed, never stored as plain text. The role is always 'student' here.
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, enrollment_no, department, semester)
       VALUES ($1, $2, $3, 'student', $4, $5, $6)
       RETURNING id, name, email, role, enrollment_no, department, semester`,
      [name, email, passwordHash, enrollment_no || null, department || null, semester || null]
    );

    const user = result.rows[0];
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    next(err);
  }
});

// POST /api/auth/login: checks credentials and returns a JWT
router.post('/login', loginRules, validate, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `SELECT id, name, email, password_hash, role, enrollment_no, department, semester
       FROM users WHERE email = $1`,
      [email]
    );

    // Same message for wrong email and wrong password, so attackers learn nothing
    const invalid = () => res.status(401).json({ error: 'Invalid email or password' });

    if (result.rows.length === 0) return invalid();

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return invalid();

    delete user.password_hash;
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me: returns the logged-in user (protected route)
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, enrollment_no, department, semester, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
