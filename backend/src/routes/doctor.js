// Doctor routes — protected, require doctor role and approval
const express = require('express');
const { verifyToken, requireRole, requireApproved } = require('../middleware/auth');
const {
  getGrantedPatients,
  requestAccess,
  getMyAccessRequests,
  getPatientRecords,
} = require('../controllers/doctorController');

const router = express.Router();

// All doctor routes require a valid token, the 'doctor' role, and approval
router.use(verifyToken, requireRole('doctor'), requireApproved);

router.get('/patients', getGrantedPatients);
router.post('/access-requests/:patientId', requestAccess);
router.get('/access-requests', getMyAccessRequests);
router.get('/patients/:patientId/records', getPatientRecords);

module.exports = router;
