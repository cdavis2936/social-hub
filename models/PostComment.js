const mongoose = require('mongoose');

const postCommentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  text: { type: String, maxlength: 1000, required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likesCount: { type: Number, default: 0 },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'PostComment' },
  createdAt: { type: Date, default: Date.now }
});

postCommentSchema.index({ postId: 1, createdAt: -1 });
postCommentSchema.index({ replyTo: 1 });

module.exports = mongoose.model('PostComment', postCommentSchema);
