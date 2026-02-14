const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  caption: { type: String, maxlength: 2200, default: '' },
  
  // Media - can be single image/video or carousel
  media: [{
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    url: { type: String, required: true },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    duration: { type: String } // for videos
  }],
  
  // Location
  location: { 
    name: { type: String, maxlength: 100 },
    latitude: { type: Number },
    longitude: { type: Number }
  },
  
  // Hashtags (extracted from caption)
  hashtags: [{ type: String }],
  
  // Engagement
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  savesCount: { type: Number, default: 0 },
  
  // Audience
  taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Status
  isArchived: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false },
  
  // Feed ranking
  engagementScore: { type: Number, default: 0 },
  
  createdAt: { type: Date, default: Date.now }
});

// Indexes
postSchema.index({ createdAt: -1 });
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ engagementScore: -1 });
postSchema.index({ 'location.name': 1 });

// Virtual for isLiked
postSchema.virtual('isLiked').set(function(isLiked) {
  this._isLiked = isLiked;
});

module.exports = mongoose.model('Post', postSchema);
