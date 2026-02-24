// Patient controller — own record management and access permission responses
const PatientRecord = require('../models/PatientRecord');
const AccessPermission = require('../models/AccessPermission');
const AuditLog = require('../models/AuditLog');

/**
 * GET /api/patient/records
 * Returns all records belonging to the authenticated patient.
 */
const getMyRecords = async (req, res) => {
  try {
    const records = await PatientRecord.find({ patientId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ records });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/patient/records
 * Patient creates a new medical record.
 */
const createRecord = async (req, res) => {
  const { title, description, diagnosis, prescription } = req.body;

  try {
    const record = await PatientRecord.create({
      patientId: req.user._id,
      title,
      description,
      diagnosis,
      prescription,
    });

    // Audit: log record creation
    await AuditLog.create({
      action: 'RECORD_CREATED',
      performedBy: req.user._id,
      targetUser: req.user._id,
      details: { recordId: record._id, title },
    });

    return res.status(201).json({ message: 'Record created', record });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/patient/access-requests
 * Returns all access requests directed at this patient.
 */
const getAccessRequests = async (req, res) => {
  try {
    const requests = await AccessPermission.find({ patientId: req.user._id })
      .populate('doctorId', 'name email specialization')
      .sort({ requestedAt: -1 });

    return res.status(200).json({ requests });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * PATCH /api/patient/access-requests/:requestId/grant
 * Patient grants an access request from a doctor.
 */
const grantAccess = async (req, res) => {
  try {
    const permission = await AccessPermission.findOne({
      _id: req.params.requestId,
      patientId: req.user._id,
    });

    if (!permission) {
      return res.status(404).json({ message: 'Access request not found' });
    }

    permission.status = 'granted';
    permission.respondedAt = new Date();
    await permission.save();

    // Audit: log access grant
    await AuditLog.create({
      action: 'ACCESS_GRANTED',
      performedBy: req.user._id,
      targetUser: permission.doctorId,
      details: { permissionId: permission._id },
    });

    return res.status(200).json({ message: 'Access granted', permission });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * PATCH /api/patient/access-requests/:requestId/revoke
 * Patient revokes a previously granted or pending access request.
 */
const revokeAccess = async (req, res) => {
  try {
    const permission = await AccessPermission.findOne({
      _id: req.params.requestId,
      patientId: req.user._id,
    });

    if (!permission) {
      return res.status(404).json({ message: 'Access request not found' });
    }

    permission.status = 'revoked';
    permission.respondedAt = new Date();
    await permission.save();

    // Audit: log access revocation
    await AuditLog.create({
      action: 'ACCESS_REVOKED',
      performedBy: req.user._id,
      targetUser: permission.doctorId,
      details: { permissionId: permission._id },
    });

    return res.status(200).json({ message: 'Access revoked', permission });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getMyRecords, createRecord, getAccessRequests, grantAccess, revokeAccess };
