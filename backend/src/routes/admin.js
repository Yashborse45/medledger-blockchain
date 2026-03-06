// Admin routes — protected, require admin role
const express = require('express');
const { body } = require('express-validator');
const { verifyToken, requireRole } = require('../middleware/auth');
const { handleValidationErrors, validateObjectIdParam } = require('../middleware/validation');
const {
  getAllUsers,
  createDoctor,
  approveUser,
  deactivateUser,
  getAuditLogs,
  verifyAuditLog,
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require a valid token and the 'admin' role
router.use(verifyToken, requireRole('admin'));

router.get('/users', getAllUsers);
router.post(
  '/doctors',
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
    body('specialization')
      .optional()
      .trim()
      .isLength({ max: 120 })
      .withMessage('Specialization must be at most 120 characters'),
    handleValidationErrors,
  ],
  createDoctor
);
router.patch('/users/:id/approve', [validateObjectIdParam('id', 'user id'), handleValidationErrors], approveUser);
router.patch(
  '/users/:id/deactivate',
  [validateObjectIdParam('id', 'user id'), handleValidationErrors],
  deactivateUser
);
router.get('/audit-logs', getAuditLogs);
router.get(
  '/audit-logs/:id/verify',
  [validateObjectIdParam('id', 'audit log id'), handleValidationErrors],
  verifyAuditLog
);

module.exports = router;
