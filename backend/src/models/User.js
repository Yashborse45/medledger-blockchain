// User model — single collection for all roles (admin, doctor, patient)
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
  },
  role: {
    type: String,
    enum: ['admin', 'doctor', 'patient'],
    required: [true, 'Role is required'],
  },
  // Patients require admin approval; admin and doctors are approved by default
  isApproved: {
    type: Boolean,
    default: false,
  },
  // Specialization is relevant for doctors only
  specialization: {
    type: String,
    trim: true,
  },
  ethereumAddress: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address'],
    unique: true,
    sparse: true,
  },
  walletLinkNonce: {
    type: String,
    default: null,
  },
  walletLinkNonceExpiresAt: {
    type: Date,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare plain-text password with hashed password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
