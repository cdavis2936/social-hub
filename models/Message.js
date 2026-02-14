const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  text: { type: String, maxlength: 1000 },
  mediaType: { type: String, enum: ['image', 'video', 'voice', 'document', 'gif'] },
  mediaUrl: { type: String },
  duration: { type: String },
  reactions: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String, required: true }
  }],
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  forwarded: { type: Boolean, default: false },
  forwardedFrom: { type: String },
  edited: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deliveredAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

messageSchema.index({ fromUserId: 1, toUserId: 1, createdAt: 1 });
messageSchema.index({ groupId: 1, createdAt: 1 });
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
