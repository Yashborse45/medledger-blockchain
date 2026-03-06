// Patient routes — protected, require patient role and approval
const express = require('express');
const { body } = require('express-validator');
const { verifyToken, requireRole, requireApproved } = require('../middleware/auth');
const { handleValidationErrors, validateObjectIdParam } = require('../middleware/validation');
const {
  getMyRecords,
  createRecord,
  getAccessRequests,
  grantAccess,
  revokeAccess,
} = require('../controllers/patientController');

const router = express.Router();

// All patient routes require a valid token, the 'patient' role, and approval
router.use(verifyToken, requireRole('patient'), requireApproved);

router.get('/records', getMyRecords);
router.post(
  '/records',
  [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 120 })
      .withMessage('Title must be at most 120 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Description must be at most 2000 characters'),
    body('diagnosis')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Diagnosis must be at most 500 characters'),
    body('prescription')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Prescription must be at most 500 characters'),
    handleValidationErrors,
  ],
  createRecord
);
router.get('/access-requests', getAccessRequests);
router.patch(
  '/access-requests/:requestId/grant',
  [validateObjectIdParam('requestId', 'request id'), handleValidationErrors],
  grantAccess
);
router.patch(
  '/access-requests/:requestId/revoke',
  [validateObjectIdParam('requestId', 'request id'), handleValidationErrors],
  revokeAccess
);

module.exports = router;
