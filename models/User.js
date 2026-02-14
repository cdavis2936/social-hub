const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  displayName: { type: String, maxlength: 60 },
  description: { type: String, maxlength: 200, default: '' },
  avatarUrl: { type: String, maxlength: 500, default: '' },
  passwordHash: { type: String, required: true },
  
  // Email & Verification
  email: { type: String, maxlength: 255, default: '' },
  emailVerified: { type: Boolean, default: false },
  emailVerifyToken: { type: String, default: '' },
  
  // Two-Factor Authentication
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: '' },
  twoFactorBackupCodes: [{ type: String }],
  
  // Account Recovery
  recoveryToken: { type: String, default: '' },
  recoveryExpiresAt: { type: Date },
  
  // Security
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  
  createdAt: { type: Date, default: Date.now }
});

// Simple bcrypt hash detection - bcrypt hashes start with $2a$, $2b$, or $2y$
const isBcryptHash = (str) => str && typeof str === 'string' && str.startsWith('$2');

userSchema.pre('save', async function(next) {
  // Hash password if it's modified or doesn't look like a bcrypt hash
  if (this.isModified('passwordHash') || !isBcryptHash(this.passwordHash)) {
    try {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    } catch (err) {
      return next(err);
    }
  }
  next();
});

userSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
