// Authentication and authorization middleware
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * verifyToken — validates Bearer JWT from Authorization header
 * and attaches the decoded user document to req.user
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data to check isActive / isApproved state
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * requireRole — middleware factory that restricts access to specific roles
 * Usage: requireRole('admin', 'doctor')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient role' });
    }
    next();
  };
};

/**
 * requireApproved — ensures the authenticated user has been approved
 */
const requireApproved = (req, res, next) => {
  if (!req.user.isApproved) {
    return res.status(403).json({ message: 'Account pending approval' });
  }
  next();
};

module.exports = { verifyToken, requireRole, requireApproved };
