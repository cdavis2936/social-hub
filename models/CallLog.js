const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema({
  callerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  callerUsername: { type: String, required: true },
  calleeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  calleeUsername: { type: String, required: true },
  type: { type: String, enum: ['audio', 'video'], required: true },
  status: { type: String, enum: ['missed', 'answered', 'declined'], required: true },
  duration: { type: Number, default: 0 }, // Duration in seconds
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

callLogSchema.index({ callerId: 1, createdAt: -1 });
callLogSchema.index({ calleeId: 1, createdAt: -1 });

module.exports = mongoose.model('CallLog', callLogSchema);
