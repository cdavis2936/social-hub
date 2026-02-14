const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  mediaUrl: { type: String, required: true },
  mediaType: { type: String, enum: ['image', 'video'], required: true },
  caption: { type: String, maxlength: 150 },
  viewed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reactions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    emoji: { type: String, default: '❤️' },
    createdAt: { type: Date, default: Date.now }
  }],
  replies: [{
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fromUsername: String,
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  isHighlight: { type: Boolean, default: false },
  highlightTitle: { type: String, maxlength: 30 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => Date.now() + 24 * 60 * 60 * 1000 } // 24 hours
});

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ userId: 1, createdAt: -1 });
storySchema.index({ userId: 1, isHighlight: 1 });

module.exports = mongoose.model('Story', storySchema);
