// AuditLog model — immutable event log, prepared for blockchain integration
const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  // Action identifier e.g. LOGIN, ACCESS_GRANTED, RECORD_VIEWED
  action: {
    type: String,
    required: true,
  },
  // User who performed the action
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Optional target user (e.g. patient whose record was accessed)
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Flexible payload for action-specific metadata
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  // Placeholder for future blockchain transaction hash
  blockchainTxHash: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
