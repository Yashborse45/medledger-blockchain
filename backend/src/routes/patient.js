// Patient routes — protected, require patient role and approval
const express = require('express');
const { verifyToken, requireRole, requireApproved } = require('../middleware/auth');
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
router.post('/records', createRecord);
router.get('/access-requests', getAccessRequests);
router.patch('/access-requests/:requestId/grant', grantAccess);
router.patch('/access-requests/:requestId/revoke', revokeAccess);

module.exports = router;
