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
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/admin/doctors
 * Admin creates a doctor account. isApproved defaults to true.
 */
const createDoctor = async (req, res) => {
  const { name, email, password, specialization } = req.body;

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
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * PATCH /api/admin/users/:id/approve
 * Approves a patient account.
 */
const approveUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ message: 'User approved', user });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * PATCH /api/admin/users/:id/deactivate
 * Deactivates a user account, preventing login.
 */
const deactivateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ message: 'User deactivated', user });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/admin/audit-logs
 * Returns all audit log entries, newest first.
 */
const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('performedBy', 'name email role')
      .populate('targetUser', 'name email role')
      .sort({ timestamp: -1 });

    return res.status(200).json({ logs });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getAllUsers, createDoctor, approveUser, deactivateUser, getAuditLogs };
