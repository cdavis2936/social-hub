const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  device: { type: String, default: 'unknown' },
  browser: { type: String, default: 'unknown' },
  os: { type: String, default: 'unknown' },
  ipAddress: { type: String, default: '' },
  location: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  lastActiveAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  isCurrent: { type: Boolean, default: false },
  trusted: { type: Boolean, default: false },
  suspicious: { type: Boolean, default: false },
  loginMethod: { type: String, enum: ['password', '2fa', 'recovery'], default: 'password' }
});

sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ token: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
