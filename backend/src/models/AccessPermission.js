// AccessPermission model — tracks doctor-patient access grant lifecycle
const mongoose = require('mongoose');

const AccessPermissionSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Lifecycle: pending → granted or revoked
  status: {
    type: String,
    enum: ['pending', 'granted', 'revoked'],
    default: 'pending',
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  respondedAt: {
    type: Date,
  },
});

module.exports = mongoose.model('AccessPermission', AccessPermissionSchema);
