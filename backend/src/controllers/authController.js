// Auth controller — handles registration and login
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

/**
 * POST /api/auth/register
 * Patient self-registration. isApproved defaults to false until admin approves.
 */
const register = async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const { password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'patient',
      isApproved: false,
    });

    return res.status(201).json({
      message: 'Registration successful. Await admin approval.',
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/auth/login
 * Login for all roles. Returns JWT containing id, role, and isApproved.
 */
const login = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const { password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Sign JWT with user id and role only; approval is re-validated per request
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Audit: log successful login
    await AuditLog.create({
      action: 'LOGIN',
      performedBy: user._id,
      details: { email: user.email, role: user.role },
    });

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { register, login };
