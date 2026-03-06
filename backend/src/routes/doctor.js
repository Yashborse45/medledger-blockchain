// Doctor routes — protected, require doctor role and approval
const express = require('express');
const { verifyToken, requireRole, requireApproved } = require('../middleware/auth');
const { handleValidationErrors, validateObjectIdParam } = require('../middleware/validation');
const {
  searchPatients,
  getGrantedPatients,
  requestAccess,
  getMyAccessRequests,
  getPatientRecords,
} = require('../controllers/doctorController');

const router = express.Router();

// All doctor routes require a valid token, the 'doctor' role, and approval
router.use(verifyToken, requireRole('doctor'), requireApproved);

// Search must come before /:patientId routes so 'search' is not treated as an ObjectId param
router.get('/patients/search', searchPatients);
router.get('/patients', getGrantedPatients);
router.post(
  '/access-requests/:patientId',
  [validateObjectIdParam('patientId', 'patient id'), handleValidationErrors],
  requestAccess
);
router.get('/access-requests', getMyAccessRequests);
router.get(
  '/patients/:patientId/records',
  [validateObjectIdParam('patientId', 'patient id'), handleValidationErrors],
  getPatientRecords
);

module.exports = router;
