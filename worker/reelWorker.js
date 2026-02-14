require('dotenv').config();

const path = require('path');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const mongoose = require('mongoose');
const { processReelJob } = require('../reelProcessor');

if (!process.env.REDIS_URL) {
  console.error('REDIS_URL is required to run the worker');
  process.exit(1);
}

const uploadsDir = path.join(__dirname, '..', 'uploads');
const maxDurationSeconds = Number(process.env.MAX_REEL_DURATION_SECONDS || 60);
const silentIo = { emit: () => {} };

let worker;
let disabledTicker;
let mongoConnected = false;

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/social_app');
    console.log('Worker connected to MongoDB');
    mongoConnected = true;
  } catch (err) {
    console.warn('MongoDB unavailable, worker running in disabled mode.');
    disabledTicker = setInterval(() => {}, 1 << 30);
    return;
  }

  try {
    await redis.connect();
    await redis.ping();
  } catch (_err) {
    console.warn('Redis unavailable, worker running in disabled mode.');
    disabledTicker = setInterval(() => {}, 1 << 30);
    return;
  }

  worker = new Worker(
    'reel-processing',
    async (job) => {
      await processReelJob({
        reelId: job.data.reelId,
        uploadsDir,
        io: silentIo,
        publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:4000',
        maxDurationSeconds
      });
    },
    { connection: redis, concurrency: 3 }
  );

  worker.on('completed', (job) => {
    console.log(`Processed reel job ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Failed reel job ${job?.id}:`, err.message);
  });

  console.log('Reel worker started');
})();

const redis = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  retryStrategy: () => null
});
redis.on('error', () => {});

async function shutdown() {
  if (disabledTicker) clearInterval(disabledTicker);
  if (worker) await worker.close();
  await redis.quit().catch(() => null);
  if (mongoConnected) await mongoose.connection.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
