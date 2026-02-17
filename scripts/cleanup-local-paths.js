/**
 * Script to completely clean up all media records and start fresh with Firebase.
 * Run with: node scripts/cleanup-local-paths.js
 * 
 * WARNING: This will delete ALL stories, posts with media, and messages with media!
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social_app';

async function cleanup() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const Story = require('../models/Story');
  const Post = require('../models/Post');
  const Message = require('../models/Message');


  // Delete ALL stories (they all have media)
  const storyResult = await Story.deleteMany({});
  console.log(`Deleted ${storyResult.deletedCount} stories`);

  // Delete ALL posts with media (media array not empty)
  const postResult = await Post.deleteMany({ 
    media: { $exists: true, $ne: [] }
  });
  console.log(`Deleted ${postResult.deletedCount} posts with media`);

  // Delete ALL messages with media
  const messageResult = await Message.deleteMany({ 
    mediaUrl: { $exists: true, $ne: null }
  });
  console.log(`Deleted ${messageResult.deletedCount} messages with media`);



  console.log('\n✓ Cleanup complete! All media records have been deleted.');
  console.log('New uploads will use Firebase Storage.');
  
  await mongoose.disconnect();
  process.exit(0);
}

cleanup().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
