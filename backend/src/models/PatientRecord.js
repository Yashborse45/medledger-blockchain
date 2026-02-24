// PatientRecord model — medical records belonging to a patient
const mongoose = require('mongoose');

const PatientRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    diagnosis: {
      type: String,
      trim: true,
    },
    prescription: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // auto-manages createdAt and updatedAt
  }
);

module.exports = mongoose.model('PatientRecord', PatientRecordSchema);
