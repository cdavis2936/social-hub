const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  reelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reel', required: true },
  text: { type: String, required: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now }
});

commentSchema.index({ reelId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
