// Admin controller — user management and audit log access
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

/**
 * GET /api/admin/users
 * Returns all users (excluding passwords).
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.status(200).json({ users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/admin/doctors
 * Admin creates a doctor account. isApproved defaults to true.
 */
const createDoctor = async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const { password } = req.body;
  const specialization = req.body.specialization?.trim() || undefined;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const doctor = await User.create({
      name,
      email,
      password,
      role: 'doctor',
      isApproved: true,
      specialization,
    });

    await AuditLog.create({
      action: 'DOCTOR_CREATED',
      performedBy: req.user._id,
      targetUser: doctor._id,
      details: { email: doctor.email, specialization: doctor.specialization || null },
    });

    return res.status(201).json({
      message: 'Doctor account created',
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    console.error('Failed to create doctor:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * PATCH /api/admin/users/:id/approve
 * Approves a patient account.
 */
const approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role !== 'patient') {
      return res.status(400).json({ message: 'Only patient accounts can be approved' });
    }
    if (user.isApproved) {
      return res.status(200).json({
        message: 'User is already approved',
        user: { id: user._id, name: user.name, email: user.email, role: user.role, isApproved: true },
      });
    }

    user.isApproved = true;
    await user.save();

    await AuditLog.create({
      action: 'USER_APPROVED',
      performedBy: req.user._id,
      targetUser: user._id,
      details: { role: user.role },
    });

    return res.status(200).json({
      message: 'User approved',
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isApproved: true },
    });
  } catch (error) {
    console.error('Failed to approve user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * PATCH /api/admin/users/:id/deactivate
 * Deactivates a user account, preventing login.
 */
const deactivateUser = async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(200).json({
        message: 'User is already deactivated',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: user.isApproved,
          isActive: false,
        },
      });
    }

    user.isActive = false;
    await user.save();

    await AuditLog.create({
      action: 'USER_DEACTIVATED',
      performedBy: req.user._id,
      targetUser: user._id,
      details: { role: user.role },
    });

    return res.status(200).json({
      message: 'User deactivated',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        isActive: false,
      },
    });
  } catch (error) {
    console.error('Failed to deactivate user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /api/admin/audit-logs
 * Returns all audit log entries, newest first.
 */
const getAuditLogs = async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 200;

    const logs = await AuditLog.find()
      .populate('performedBy', 'name email role')
      .populate('targetUser', 'name email role')
      .sort({ timestamp: -1 })
      .limit(limit);

    return res.status(200).json({ logs });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getAllUsers, createDoctor, approveUser, deactivateUser, getAuditLogs };
