const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  // Who created the ad (user or advertiser)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Post being boosted
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  
  // Ad details
  title: { type: String, maxlength: 100, default: '' },
  description: { type: String, maxlength: 500, default: '' },
  callToAction: { type: String, enum: ['shop_now', 'learn_more', 'sign_up', 'none'], default: 'none' },
  targetUrl: { type: String, maxlength: 500, default: '' },
  
  // Targeting
  targetLocations: [{ type: String }], // cities, countries
  targetInterests: [{ type: String }], // hashtags, topics
  targetAgeMin: { type: Number, min: 13, max: 100 },
  targetAgeMax: { type: Number, min: 13, max: 100 },
  
  // Budget & Scheduling
  budget: { type: Number, required: true, min: 1 }, // total budget in cents
  dailyBudget: { type: Number }, // daily spending limit
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  
  // Scheduling
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  
  // Status
  status: { 
    type: String, 
    enum: ['draft', 'active', 'paused', 'completed', 'rejected'], 
    default: 'draft' 
  },
  
  // Payment
  paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
  amountSpent: { type: Number, default: 0 },
  
  createdAt: { type: Date, default: Date.now }
});

adSchema.index({ status: 1, startDate: 1 });
adSchema.index({ postId: 1 });

module.exports = mongoose.model('Ad', adSchema);
