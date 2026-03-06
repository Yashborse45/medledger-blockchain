// Doctor controller — access requests and viewing patient records
const AccessPermission = require('../models/AccessPermission');
const PatientRecord = require('../models/PatientRecord');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

/**
 * GET /api/doctor/patients/search?q=
 * Search approved, active patients by name or email (partial, case-insensitive).
 * Returns only id, name, and email — no sensitive record data.
 * Requires at least 2 characters to prevent dumping the full patient list.
 */
const searchPatients = async (req, res) => {
  const q = req.query.q?.trim();

  if (!q || q.length < 2) {
    return res.status(400).json({ message: 'Search query must be at least 2 characters' });
  }

  try {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const patients = await User.find({
      role: 'patient',
      isApproved: true,
      isActive: true,
      $or: [{ name: regex }, { email: regex }],
    })
      .select('_id name email')
      .limit(20)
      .lean();

    return res.status(200).json({ patients });
  } catch (error) {
    console.error('Failed to search patients:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

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

    const patients = permissions
      .map((permission) => permission.patientId)
      .filter(Boolean);
    return res.status(200).json({ patients });
  } catch (error) {
    console.error('Failed to fetch granted patients:', error);
    return res.status(500).json({ message: 'Internal server error' });
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
    const patient = await User.findOne({ _id: patientId, role: 'patient' }).select(
      'name email isActive isApproved'
    );
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    if (!patient.isActive) {
      return res.status(400).json({ message: 'Cannot request access to an inactive patient account' });
    }
    if (!patient.isApproved) {
      return res.status(400).json({ message: 'Cannot request access until patient is approved' });
    }

    // Prevent duplicate pending/granted requests and allow re-request after revoke
    const existing = await AccessPermission.findOne({
      doctorId: req.user._id,
      patientId,
    });
    if (existing) {
      if (existing.status === 'pending' || existing.status === 'granted') {
        return res.status(409).json({ message: 'Access request already exists' });
      }

      existing.status = 'pending';
      existing.requestedAt = new Date();
      existing.respondedAt = undefined;
      await existing.save();

      await AuditLog.create({
        action: 'ACCESS_REQUESTED',
        performedBy: req.user._id,
        targetUser: patientId,
        details: { permissionId: existing._id, repeated: true },
      });

      return res.status(200).json({ message: 'Access request resubmitted', permission: existing });
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
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Access request already exists' });
    }
    console.error('Failed to request access:', error);
    return res.status(500).json({ message: 'Internal server error' });
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
    console.error('Failed to fetch access requests:', error);
    return res.status(500).json({ message: 'Internal server error' });
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
    console.error('Failed to fetch patient records:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { searchPatients, getGrantedPatients, requestAccess, getMyAccessRequests, getPatientRecords };
