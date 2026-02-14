const mongoose = require('mongoose');

const reelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  caption: { type: String, maxlength: 180 },
  sourceVideoUrl: { type: String, required: true },
  videoUrl: { type: String },
  likes: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['PROCESSING', 'READY', 'REJECTED', 'FAILED'], 
    default: 'PROCESSING' 
  },
  moderationReason: { type: String },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

reelSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Reel', reelSchema);
