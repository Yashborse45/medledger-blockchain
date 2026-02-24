// Doctor controller — access requests and viewing patient records
const AccessPermission = require('../models/AccessPermission');
const PatientRecord = require('../models/PatientRecord');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

/**
 * GET /api/doctor/patients
 * Returns patients where this doctor has been granted access.
 */
const getGrantedPatients = async (req, res) => {
  try {
    const permissions = await AccessPermission.find({
      doctorId: req.user._id,
      status: 'granted',
    }).populate('patientId', 'name email');

    const patients = permissions.map((p) => p.patientId);
    return res.status(200).json({ patients });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/doctor/access-requests/:patientId
 * Doctor requests access to a patient's records.
 */
const requestAccess = async (req, res) => {
  const { patientId } = req.params;

  try {
    // Verify the target is a valid patient
    const patient = await User.findOne({ _id: patientId, role: 'patient' });
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Prevent duplicate pending/granted requests
    const existing = await AccessPermission.findOne({
      doctorId: req.user._id,
      patientId,
      status: { $in: ['pending', 'granted'] },
    });
    if (existing) {
      return res.status(409).json({ message: 'Access request already exists' });
    }

    const permission = await AccessPermission.create({
      doctorId: req.user._id,
      patientId,
    });

    // Audit: log access request
    await AuditLog.create({
      action: 'ACCESS_REQUESTED',
      performedBy: req.user._id,
      targetUser: patientId,
      details: { permissionId: permission._id },
    });

    return res.status(201).json({ message: 'Access request submitted', permission });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/doctor/access-requests
 * Returns all access requests made by this doctor with their statuses.
 */
const getMyAccessRequests = async (req, res) => {
  try {
    const requests = await AccessPermission.find({ doctorId: req.user._id })
      .populate('patientId', 'name email')
      .sort({ requestedAt: -1 });

    return res.status(200).json({ requests });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/doctor/patients/:patientId/records
 * View records for a patient — only if access has been granted.
 */
const getPatientRecords = async (req, res) => {
  const { patientId } = req.params;

  try {
    // Confirm access is granted before returning records
    const permission = await AccessPermission.findOne({
      doctorId: req.user._id,
      patientId,
      status: 'granted',
    });

    if (!permission) {
      return res.status(403).json({ message: 'Access not granted for this patient' });
    }

    const records = await PatientRecord.find({ patientId }).sort({ createdAt: -1 });

    // Audit: log that doctor viewed records
    await AuditLog.create({
      action: 'RECORD_VIEWED',
      performedBy: req.user._id,
      targetUser: patientId,
      details: { recordCount: records.length },
    });

    return res.status(200).json({ records });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getGrantedPatients, requestAccess, getMyAccessRequests, getPatientRecords };
