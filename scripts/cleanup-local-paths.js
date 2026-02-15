/**
 * Script to clean up old records with local paths from the database.
 * Run with: node scripts/cleanup-local-paths.js
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
  const Reel = require('../models/Reel');

  // Pattern for local paths
  const localPathPattern = /^\/uploads\//;

  // Clean Stories
  const storyResult = await Story.deleteMany({ mediaUrl: localPathPattern });
  console.log(`Deleted ${storyResult.deletedCount} stories with local paths`);

  // Clean Posts
  const postResult = await Post.deleteMany({ 
    $or: [
      { mediaUrl: localPathPattern },
      { 'media.url': localPathPattern }
    ]
  });
  console.log(`Deleted ${postResult.deletedCount} posts with local paths`);

  // Clean Messages
  const messageResult = await Message.deleteMany({ mediaUrl: localPathPattern });
  console.log(`Deleted ${messageResult.deletedCount} messages with local paths`);

  // Clean Reels
  const reelResult = await Reel.deleteMany({ 
    $or: [
      { videoUrl: localPathPattern },
      { sourceVideoUrl: localPathPattern }
    ]
  });
  console.log(`Deleted ${reelResult.deletedCount} reels with local paths`);

  console.log('\nCleanup complete!');
  console.log('Note: Users will need to re-upload content that was stored locally.');
  
  await mongoose.disconnect();
  process.exit(0);
}

cleanup().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
