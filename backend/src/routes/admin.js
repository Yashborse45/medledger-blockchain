// Admin routes — protected, require admin role
const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  getAllUsers,
  createDoctor,
  approveUser,
  deactivateUser,
  getAuditLogs,
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require a valid token and the 'admin' role
router.use(verifyToken, requireRole('admin'));

router.get('/users', getAllUsers);
router.post('/doctors', createDoctor);
router.patch('/users/:id/approve', approveUser);
router.patch('/users/:id/deactivate', deactivateUser);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
