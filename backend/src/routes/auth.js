// Auth routes — public registration and login endpoints
const express = require('express');
const { body } = require('express-validator');
const { register, login } = require('../controllers/authController');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 80 })
      .withMessage('Name must be at most 80 characters'),
    body('email').trim().normalizeEmail().isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    handleValidationErrors,
  ],
  register
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').trim().normalizeEmail().isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
  ],
  login
);

module.exports = router;
