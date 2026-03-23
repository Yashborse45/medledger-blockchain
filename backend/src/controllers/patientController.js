// Patient controller — own record management and access permission responses
const PatientRecord = require('../models/PatientRecord');
const AccessPermission = require('../models/AccessPermission');
const User = require('../models/User');
const { createAuditLog } = require('../services/auditLog');

/**
 * GET /api/patient/records
 * Returns all records belonging to the authenticated patient.
 */
const getMyRecords = async (req, res) => {
  try {
    const records = await PatientRecord.find({ patientId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ records });
  } catch (error) {
    console.error('Failed to fetch patient records:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/patient/records
 * Patient creates a new medical record.
 */
const createRecord = async (req, res) => {
  const title = req.body.title?.trim();
  const description = req.body.description?.trim();
  const diagnosis = req.body.diagnosis?.trim();
  const prescription = req.body.prescription?.trim();

  try {
    const record = await PatientRecord.create({
      patientId: req.user._id,
      title,
      description,
      diagnosis,
      prescription,
    });

    // Audit: log record creation
    await createAuditLog({
      action: 'RECORD_CREATED',
      performedBy: req.user._id,
      targetUser: req.user._id,
      details: { recordId: record._id, title },
    });

    return res.status(201).json({ message: 'Record created', record });
  } catch (error) {
    console.error('Failed to create record:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /api/patient/access-requests
 * Returns all access requests directed at this patient.
 */
const getAccessRequests = async (req, res) => {
  try {
    const requests = await AccessPermission.find({ patientId: req.user._id })
      .populate('doctorId', 'name email specialization ethereumAddress')
      .sort({ requestedAt: -1 });

    return res.status(200).json({ requests });
  } catch (error) {
    console.error('Failed to fetch incoming requests:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * PATCH /api/patient/access-requests/:requestId/grant
 * Patient grants an access request from a doctor.
 */
const grantAccess = async (req, res) => {
  const paymentTxHash = req.body.paymentTxHash?.trim();

  try {
    const permission = await AccessPermission.findOne({
      _id: req.params.requestId,
      patientId: req.user._id,
    });

    if (!permission) {
      return res.status(404).json({ message: 'Access request not found' });
    }
    if (permission.status === 'granted') {
      return res.status(409).json({ message: 'Access is already granted' });
    }
    if (permission.status === 'revoked') {
      return res.status(409).json({ message: 'Cannot grant a revoked request. Ask doctor to re-request.' });
    }

    const doctor = await User.findOne({ _id: permission.doctorId, role: 'doctor' }).select(
      'ethereumAddress'
    );
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor account not found for this request' });
    }
    if (!doctor.ethereumAddress) {
      return res.status(400).json({ message: 'Doctor wallet address is not configured' });
    }

    permission.status = 'granted';
    permission.respondedAt = new Date();
    permission.paymentTxHash = paymentTxHash;
    await permission.save();

    // Audit: log access grant that includes payment transaction hash
    await createAuditLog({
      action: 'ACCESS_GRANTED_WITH_PAYMENT',
      performedBy: req.user._id,
      targetUser: permission.doctorId,
      details: {
        permissionId: permission._id,
        paymentTxHash,
      },
    });

    return res.status(200).json({ message: 'Access granted', permission });
  } catch (error) {
    console.error('Failed to grant access:', error);
    return res.status(500).json({ message: 'Internal server error' });
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
    if (permission.status === 'revoked') {
      return res.status(409).json({ message: 'Access is already revoked' });
    }

    permission.status = 'revoked';
    permission.respondedAt = new Date();
    await permission.save();

    // Audit: log access revocation
    await createAuditLog({
      action: 'ACCESS_REVOKED',
      performedBy: req.user._id,
      targetUser: permission.doctorId,
      details: { permissionId: permission._id },
    });

    return res.status(200).json({ message: 'Access revoked', permission });
  } catch (error) {
    console.error('Failed to revoke access:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getMyRecords, createRecord, getAccessRequests, grantAccess, revokeAccess };
