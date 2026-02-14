const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const mongoose = require('mongoose');
const Reel = require('./models/Reel');
const User = require('./models/User');

const bannedWords = ['violence', 'terror', 'hate'];

function execFileAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        const detail = stderr || stdout || err.message;
        reject(new Error(detail));
        return;
      }
      resolve((stdout || '').trim());
    });
  });
}

async function checkBinary(name) {
  try {
    await execFileAsync(name, ['-version']);
    return true;
  } catch (_err) {
    return false;
  }
}

function normalizeCaption(caption) {
  return String(caption || '').trim().slice(0, 180);
}

function moderateCaption(caption) {
  const value = normalizeCaption(caption).toLowerCase();
  for (const word of bannedWords) {
    if (value.includes(word)) {
      return `caption contains restricted term: ${word}`;
    }
  }
  return null;
}

async function probeDurationSeconds(filePath) {
  const output = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nokey=1:noprint_wrappers=1',
    filePath
  ]);

  return Number(output);
}

async function transcodeToMp4(inputPath, outputPath, trimSeconds = null) {
  const ffmpegArgs = [
    '-y',
    '-i',
    inputPath,
  ];

  if (Number.isFinite(trimSeconds) && trimSeconds > 0) {
    ffmpegArgs.push('-t', String(trimSeconds));
  }

  ffmpegArgs.push(
    '-vf',
    "scale='min(720,iw)':-2",
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '28',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outputPath
  );

  await execFileAsync('ffmpeg', ffmpegArgs);
}

async function processReelJob({ reelId, uploadsDir, io, publicBaseUrl, maxDurationSeconds = 60 }) {
  const reel = await Reel.findById(reelId);
  if (!reel) return;

  const rejectedReason = moderateCaption(reel.caption);
  if (rejectedReason) {
    reel.status = 'REJECTED';
    reel.moderationReason = rejectedReason;
    await reel.save();
    io.emit('reel_updated', { reelId: reel._id.toString(), status: reel.status, reason: reel.moderationReason });
    return;
  }

  const hasFfmpeg = await checkBinary('ffmpeg');
  const hasFfprobe = await checkBinary('ffprobe');
  if (!hasFfmpeg || !hasFfprobe) {
    reel.status = 'FAILED';
    reel.moderationReason = 'ffmpeg/ffprobe not available on server';
    await reel.save();
    io.emit('reel_updated', { reelId: reel._id.toString(), status: 'FAILED', reason: 'missing ffmpeg/ffprobe' });
    return;
  }

  const sourcePath = path.join(uploadsDir, reel.sourceVideoUrl.replace('/uploads/', ''));
  await fs.access(sourcePath);

  const duration = await probeDurationSeconds(sourcePath);
  if (!Number.isFinite(duration) || duration <= 0) {
    reel.status = 'FAILED';
    reel.moderationReason = 'invalid media duration';
    await reel.save();
    io.emit('reel_updated', { reelId: reel._id.toString(), status: 'FAILED', reason: 'invalid media duration' });
    return;
  }

  const processedRelPath = `processed/${reel._id}.mp4`;
  const processedAbsPath = path.join(uploadsDir, processedRelPath);

  const trimDuration = duration > maxDurationSeconds ? maxDurationSeconds : null;
  await transcodeToMp4(sourcePath, processedAbsPath, trimDuration);

  reel.status = 'READY';
  reel.videoUrl = `/uploads/${processedRelPath}`;
  reel.processedAt = new Date();
  reel.moderationReason = null;
  await reel.save();

  const user = await User.findById(reel.userId);
  io.emit('new_reel', {
    id: reel._id.toString(),
    userId: reel.userId.toString(),
    username: user?.username,
    caption: reel.caption,
    videoUrl: reel.videoUrl,
    likes: reel.likes,
    status: reel.status,
    createdAt: reel.createdAt
  });

  io.emit('reel_updated', { reelId: reel._id.toString(), status: reel.status, reason: null });
}

module.exports = {
  normalizeCaption,
  processReelJob
};
