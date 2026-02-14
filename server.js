require('dotenv').config();

const express = require('express');
const http = require('http');
const https = require('https');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { execFile } = require('child_process');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { normalizeCaption, processReelJob } = require('./reelProcessor');
const mongoStorage = require('./mongoStorage');

// Models
const User = require('./models/User');
const Message = require('./models/Message');
const Reel = require('./models/Reel');
const Group = require('./models/Group');
const Story = require('./models/Story');
const CallLog = require('./models/CallLog');
const Session = require('./models/Session');
const Post = require('./models/Post');
const PostComment = require('./models/PostComment');
const Save = require('./models/Save');
const Ad = require('./models/Ad');
const Comment = require('./models/Comment');

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'default_dev_secret_key';
if (!JWT_SECRET) {
  console.error('JWT_SECRET environment variable is required');
  process.exit(1);
}
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '';
const SSL_CA_PATH = process.env.SSL_CA_PATH || '';

let usingHttps = false;
let server = null;
if (SSL_KEY_PATH && SSL_CERT_PATH) {
  try {
    const httpsOptions = {
      key: fs.readFileSync(path.resolve(SSL_KEY_PATH)),
      cert: fs.readFileSync(path.resolve(SSL_CERT_PATH))
    };
    if (SSL_CA_PATH) {
      httpsOptions.ca = fs.readFileSync(path.resolve(SSL_CA_PATH));
    }
    server = https.createServer(httpsOptions, app);
    usingHttps = true;
    console.log('HTTPS enabled');
  } catch (err) {
    console.error('HTTPS certificate load failed, falling back to HTTP:', err.message);
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

const ENABLE_SECURE_CONTEXT_HEADERS = usingHttps || process.env.ENABLE_SECURE_CONTEXT_HEADERS === 'true';

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `${usingHttps ? 'https' : 'http'}://localhost:${PORT}`;
const MAX_REEL_DURATION_SECONDS = Number(process.env.MAX_REEL_DURATION_SECONDS || 60);

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const ORIGINAL_DIR = path.join(UPLOAD_DIR, 'original');
const PROCESSED_DIR = path.join(UPLOAD_DIR, 'processed');
const AVATAR_DIR = path.join(UPLOAD_DIR, 'avatars');
for (const dir of [UPLOAD_DIR, ORIGINAL_DIR, PROCESSED_DIR, AVATAR_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

let redisConnection = null;
let reelQueue = null;
let queueInitAttempted = false;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ORIGINAL_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.mp4';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

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

async function transcodeStoryToMp4(inputPath, outputPath) {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
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
  ]);
}

// Story upload storage
const storyStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(UPLOAD_DIR, 'stories');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isVideo = file.mimetype.startsWith('video/');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext || (isVideo ? '.mp4' : '.jpg')}`);
  }
});
const storyUpload = multer({
  storage: storyStorage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

function isAbortLikeError(err) {
  if (!err) return false;
  return (
    err.code === 'ECONNRESET' ||
    err.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    err.message === 'aborted' ||
    err.type === 'request.aborted'
  );
}

// Security middleware
// CSP disabled for development - phones may need more permissive settings
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: ENABLE_SECURE_CONTEXT_HEADERS ? { policy: 'same-origin' } : false,
  originAgentCluster: ENABLE_SECURE_CONTEXT_HEADERS,
  contentSecurityPolicy: false
}));

if (!ENABLE_SECURE_CONTEXT_HEADERS) {
  console.log('Secure-context headers (COOP/OAC) disabled for HTTP development.');
}

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false
});

// Allow all origins for development (phones on same network)
app.use(cors({
  origin: true,
  credentials: true
}));
app.use((req, _res, next) => {
  req.wasAborted = false;
  req.on('aborted', () => {
    req.wasAborted = true;
  });
  next();
});
// Handle video streaming with Range requests
app.get('/uploads/stories/:filename', async (req, res) => {
  const filename = req.params.filename;
  
  // Security check
  if (filename.includes('..')) {
    return res.status(403).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(UPLOAD_DIR, 'stories', filename);
  
  try {
    const stat = await fs.promises.stat(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      // Parse Range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      
      res.writeHead(206, {
        'Content-Type': 'video/mp4',
        'Content-Length': chunksize,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      });
      
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      });
      
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (err) {
    console.error('Video streaming error:', err);
    res.status(404).json({ error: 'Video not found' });
  }
});

// Serve files from GridFS
app.get('/api/files/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  
  if (!mongoStorage.isGridFSReady()) {
    return res.status(404).json({ error: 'File storage not available' });
  }

  try {
    const bucket = mongoStorage.getBucket();
    const ObjectId = require('mongoose').Types.ObjectId;
    const fileObjectId = new ObjectId(fileId);
    
    // Check if file exists
    const files = await bucket.find({ _id: fileObjectId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const file = files[0];
    const contentType = file.metadata?.contentType || 'application/octet-stream';
    
    res.set('Content-Type', contentType);
    if (contentType.startsWith('video/')) {
      res.set('Accept-Ranges', 'bytes');
    }
    res.set('Access-Control-Allow-Origin', '*');
    
    const downloadStream = bucket.openDownloadStream(fileObjectId);
    downloadStream.pipe(res);
    
    downloadStream.on('error', (err) => {
      console.error('GridFS stream error:', err);
      res.status(500).json({ error: 'Error streaming file' });
    });
  } catch (err) {
    console.error('GridFS file error:', err);
    res.status(404).json({ error: 'File not found' });
  }
});

app.use(express.json({ limit: '100mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res, filePath) => {
    // Prevent path traversal and set proper headers
    if (filePath.includes('..')) {
      res.status(403).end();
      return;
    }
    // Set content-type based on extension
    if (filePath.endsWith('.mp4')) {
      res.set('Content-Type', 'video/mp4');
      res.set('Accept-Ranges', 'bytes');
    }
    // Enable CORS for media files
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  }
}));
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  maxAge: '1h'
}));

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const sanitizeUser = (u) => ({
  id: u._id.toString(),
  username: u.username,
  displayName: u.displayName || u.username,
  description: u.description || '',
  avatarUrl: u.avatarUrl || '',
  createdAt: u.createdAt
});

const formatReel = async (r) => {
  const user = await User.findById(r.userId);
  return {
    _id: r._id.toString(),
    id: r._id.toString(),
    userId: r.userId.toString(),
    username: user?.username,
    caption: r.caption,
    videoUrl: r.videoUrl,
    sourceVideoUrl: r.sourceVideoUrl,
    likes: r.likes,
    status: r.status,
    moderationReason: r.moderationReason,
    createdAt: r.createdAt,
    processedAt: r.processedAt
  };
};

function buildIceServers() {
  const stunUrls = String(process.env.STUN_URLS || 'stun:stun.l.google.com:19302')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const turnUrls = String(process.env.TURN_URLS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const servers = [];
  if (stunUrls.length) {
    servers.push({ urls: stunUrls.length === 1 ? stunUrls[0] : stunUrls });
  }

  if (turnUrls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    servers.push({
      urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    });
  }

  return servers;
}

async function enqueueReel(reelId) {
  if (!reelQueue) {
    await processReelJob({
      reelId,
      uploadsDir: UPLOAD_DIR,
      io,
      publicBaseUrl: PUBLIC_BASE_URL,
      maxDurationSeconds: MAX_REEL_DURATION_SECONDS
    });
    return;
  }

  await reelQueue.add('process', { reelId }, { removeOnComplete: 1000, removeOnFail: 1000 });
}

async function initQueueIfAvailable() {
  if (queueInitAttempted || !process.env.REDIS_URL) return;
  queueInitAttempted = true;

  const candidate = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    retryStrategy: () => null
  });
  candidate.on('error', () => {});

  try {
    await candidate.connect();
    await candidate.ping();
    redisConnection = candidate;
    reelQueue = new Queue('reel-processing', { connection: redisConnection });
    console.log('Reel queue enabled (Redis connected)');
  } catch (_err) {
    await candidate.quit().catch(() => null);
    redisConnection = null;
    reelQueue = null;
    console.warn('Redis unavailable, using inline reel processing');
  }
}

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'password must be at least 6 chars' });

  const normalized = String(username).trim().toLowerCase();
  const exists = await User.findOne({ username: normalized });
  if (exists) return res.status(409).json({ error: 'username already exists' });

  const user = await User.create({
    username: normalized,
    displayName: normalized,
    description: '',
    passwordHash: password
  });

  const token = jwt.sign({ id: user._id.toString(), username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  return res.status(201).json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  const normalized = String(username).trim().toLowerCase();
  const user = await User.findOne({ username: normalized });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await user.comparePassword(password);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  const token = jwt.sign({ id: user._id.toString(), username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  const normalized = String(username).trim().toLowerCase();
  const user = await User.findOne({ username: normalized });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remaining = Math.ceil((user.lockedUntil - new Date()) / 1000 / 60);
    return res.status(423).json({ error: `Account locked. Try again in ${remaining} minutes` });
  }

  const ok = await user.comparePassword(password);
  
  if (!ok) {
    // Increment failed attempts
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
    }
    await user.save();
    return res.status(401).json({ error: 'invalid credentials' });
  }

  // Reset failed attempts on successful login
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  // Check if 2FA is enabled - require verification
  if (user.twoFactorEnabled) {
    // Generate temp 2FA token (expires in 5 minutes)
    const tempToken = jwt.sign(
      { id: user._id.toString(), temp: true, type: '2fa' }, 
      JWT_SECRET, 
      { expiresIn: '5m' }
    );
    return res.json({ requires2FA: true, tempToken });
  }

  // Create session and check for suspicious login
  const session = await createSession(user, req, 'password');
  const isSuspicious = session.suspicious;
  
  const token = jwt.sign({ id: user._id.toString(), username: user.username, sessionId: session._id }, JWT_SECRET, { expiresIn: '7d' });
  
  // Update session with actual token
  session.token = token;
  session.isCurrent = true;
  await session.save();

  return res.json({ 
    token, 
    user: sanitizeUser(user),
    suspiciousLogin: isSuspicious,
    sessionId: session._id
  });
});

// 2FA Verification
app.post('/api/auth/verify-2fa', authLimiter, async (req, res) => {
  const { tempToken, code } = req.body || {};
  if (!tempToken || !code) return res.status(400).json({ error: 'tempToken and code are required' });

  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET);
    if (!decoded.temp || decoded.type !== '2fa') {
      return res.status(401).json({ error: 'Invalid temp token' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify TOTP code (simplified - in production use proper TOTP library)
    const secret = user.twoFactorSecret;
    const isValid = verifyTOTP(secret, code);
    
    // Also check backup codes
    const backupIndex = user.twoFactorBackupCodes?.findIndex(bc => bc === code);
    const isBackupCode = backupIndex !== -1;

    if (!isValid && !isBackupCode) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    // Remove used backup code
    if (isBackupCode && backupIndex !== -1) {
      user.twoFactorBackupCodes.splice(backupIndex, 1);
      await user.save();
    }

    // Create session
    const session = await createSession(user, req, '2fa');
    const token = jwt.sign({ id: user._id.toString(), username: user.username, sessionId: session._id }, JWT_SECRET, { expiresIn: '7d' });
    
    session.token = token;
    session.isCurrent = true;
    await session.save();

    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
});

// Setup 2FA
app.post('/api/auth/2fa/setup', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Generate secret (simplified - in production use proper TOTP library)
  const secret = generateTOTPSecret();
  const backupCodes = generateBackupCodes(8);

  user.twoFactorSecret = secret;
  user.twoFactorBackupCodes = backupCodes;
  await user.save();

  // In production, generate QR code for authenticator apps
  return res.json({ 
    secret,
    backupCodes,
    message: 'Save these backup codes! They are only shown once.'
  });
});

// Enable 2FA (after verification)
app.post('/api/auth/2fa/enable', authMiddleware, async (req, res) => {
  const { code } = req.body || {};
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!user.twoFactorSecret) {
    return res.status(400).json({ error: 'Setup 2FA first' });
  }

  const isValid = verifyTOTP(user.twoFactorSecret, code);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid verification code' });
  }

  user.twoFactorEnabled = true;
  await user.save();

  return res.json({ message: '2FA enabled successfully', user: sanitizeUser(user) });
});

// Disable 2FA
app.post('/api/auth/2fa/disable', authMiddleware, async (req, res) => {
  const { password, code } = req.body || {};
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Verify password
  const ok = await user.comparePassword(password);
  if (!ok) return res.status(401).json({ error: 'Invalid password' });

  // If 2FA is enabled, require code
  if (user.twoFactorEnabled) {
    const isValid = verifyTOTP(user.twoFactorSecret, code);
    if (!isValid) return res.status(401).json({ error: 'Invalid 2FA code' });
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = '';
  user.twoFactorBackupCodes = [];
  await user.save();

  return res.json({ message: '2FA disabled', user: sanitizeUser(user) });
});

// Email verification
app.post('/api/auth/verify-email', authMiddleware, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check if email already exists
  const existing = await User.findOne({ email, _id: { $ne: user._id } });
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  // Generate verification token
  const verifyToken = crypto.randomBytes(32).toString('hex');
  user.email = email;
  user.emailVerifyToken = verifyToken;
  await user.save();

  // In production, send email with verification link
  // For demo, return the token
  return res.json({ 
    message: 'Verification email sent',
    verifyToken // Remove in production - send via email
  });
});

// Confirm email verification
app.post('/api/auth/confirm-email', authMiddleware, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token is required' });

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.emailVerifyToken !== token) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  user.emailVerified = true;
  user.emailVerifyToken = '';
  await user.save();

  return res.json({ message: 'Email verified', user: sanitizeUser(user) });
});

// Account recovery - request reset
app.post('/api/auth/recover', authLimiter, async (req, res) => {
  const { username, email } = req.body || {};
  if (!username && !email) return res.status(400).json({ error: 'Username or email is required' });

  const query = username 
    ? { username: String(username).trim().toLowerCase() }
    : { email: String(email).trim().toLowerCase() };

  const user = await User.findOne(query);
  if (!user) {
    // Don't reveal if user exists
    return res.json({ message: 'If the account exists, a recovery email has been sent' });
  }

  // Generate recovery token
  const recoveryToken = crypto.randomBytes(32).toString('hex');
  user.recoveryToken = recoveryToken;
  user.recoveryExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  // In production, send email with recovery link
  return res.json({ 
    message: 'If the account exists, a recovery email has been sent',
    recoveryToken // Remove in production
  });
});

// Reset password with recovery token
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });

  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const user = await User.findOne({ 
    recoveryToken: token,
    recoveryExpiresAt: { $gt: new Date() }
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired recovery token' });
  }

  user.passwordHash = newPassword;
  user.recoveryToken = '';
  user.recoveryExpiresAt = null;
  
  // Invalidate all sessions
  await Session.deleteMany({ userId: user._id });
  
  await user.save();

  return res.json({ message: 'Password reset successful' });
});

// Get login activity history
app.get('/api/auth/sessions', authMiddleware, async (req, res) => {
  const sessions = await Session.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('-token');

  return res.json({ sessions });
});

// Revoke a session
app.delete('/api/auth/sessions/:sessionId', authMiddleware, async (req, res) => {
  const session = await Session.findOne({ 
    _id: req.params.sessionId, 
    userId: req.user.id 
  });

  if (!session) return res.status(404).json({ error: 'Session not found' });

  await session.deleteOne();
  return res.json({ message: 'Session revoked' });
});

// Revoke all sessions (logout everywhere)
app.post('/api/auth/sessions/revoke-all', authMiddleware, async (req, res) => {
  const { keepCurrent } = req.body || {};
  
  if (keepCurrent) {
    await Session.deleteMany({ 
      userId: req.user.id,
      isCurrent: false
    });
  } else {
    await Session.deleteMany({ userId: req.user.id });
  }

  return res.json({ message: keepCurrent ? 'All other sessions revoked' : 'All sessions revoked' });
});

// Mark session as trusted
app.post('/api/auth/sessions/:sessionId/trust', authMiddleware, async (req, res) => {
  const session = await Session.findOne({ 
    _id: req.params.sessionId, 
    userId: req.user.id 
  });

  if (!session) return res.status(404).json({ error: 'Session not found' });

  session.trusted = true;
  await session.save();

  return res.json({ message: 'Session marked as trusted' });
});

// Helper functions
function getDeviceInfo(req) {
  const ua = req.headers['user-agent'] || '';
  
  let device = 'unknown';
  let browser = 'unknown';
  let os = 'unknown';

  if (ua.includes('Mobile')) device = 'mobile';
  else if (ua.includes('Tablet')) device = 'tablet';
  else device = 'desktop';

  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS';

  return { device, browser, os };
}

async function createSession(user, req, loginMethod) {
  const { device, browser, os } = getDeviceInfo(req);
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || '';

  // Check for suspicious login
  const previousSessions = await Session.find({ userId: user._id }).limit(5).sort({ createdAt: -1 });
  let suspicious = false;

  if (previousSessions.length > 0) {
    const lastSession = previousSessions[0];
    // New IP is suspicious
    if (lastSession.ipAddress && lastSession.ipAddress !== ipAddress && ipAddress !== 'unknown') {
      // Check if it's a trusted session
      if (!lastSession.trusted) {
        suspicious = true;
      }
    }
  }

  const session = await Session.create({
    userId: user._id,
    token: '', // Will be updated after token creation
    device,
    browser,
    os,
    ipAddress,
    userAgent,
    loginMethod,
    trusted: false,
    suspicious,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return session;
}

function generateTOTPSecret() {
  // Simplified - in production use proper TOTP library like 'otpauth'
  return crypto.randomBytes(20).toString('hex').toUpperCase();
}

function verifyTOTP(secret, code) {
  // Simplified TOTP verification - in production use proper library
  // For demo, accept any 6-digit code
  return /^[0-9]{6}$/.test(code);
}

function generateBackupCodes(count) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

app.get('/api/config/rtc', authMiddleware, (_req, res) => {
  res.json({ iceServers: buildIceServers() });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/me/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'avatar file is required' });
  if (!req.file.mimetype.startsWith('image/')) {
    fs.unlink(req.file.path, () => null);
    return res.status(400).json({ error: 'avatar must be an image' });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'user not found' });

  let avatarUrl = `/uploads/avatars/${req.file.filename}`;

  // Upload to GridFS for persistence
  if (mongoStorage.isGridFSReady()) {
    try {
      const result = await mongoStorage.uploadToGridFS(req.file.path, req.file.filename, req.file.mimetype);
      avatarUrl = result.url; // Use GridFS URL
      await fs.promises.unlink(req.file.path).catch(() => null);
      console.log('Avatar uploaded to GridFS:', result.id);
    } catch (err) {
      console.error('GridFS avatar upload failed, using local storage:', err);
    }
  }

  user.avatarUrl = avatarUrl;
  await user.save();
  res.json({ user: sanitizeUser(user) });
});

app.put('/api/me/profile', authMiddleware, async (req, res) => {
  const displayName = String(req.body?.displayName || '').trim();
  const description = String(req.body?.description || '').trim();
  const avatarUrl = String(req.body?.avatarUrl || '').trim();

  if (displayName.length > 60) {
    return res.status(400).json({ error: 'displayName must be at most 60 characters' });
  }
  if (description.length > 200) {
    return res.status(400).json({ error: 'description must be at most 200 characters' });
  }
  if (avatarUrl.length > 500) {
    return res.status(400).json({ error: 'avatarUrl must be at most 500 characters' });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'user not found' });

  user.displayName = displayName || user.username;
  user.description = description;
  user.avatarUrl = avatarUrl;
  await user.save();

  res.json({ user: sanitizeUser(user) });
});

// Group Chat APIs
app.post('/api/groups', authMiddleware, async (req, res) => {
  const { name, description, memberIds } = req.body;
  
  const group = new Group({
    name,
    description,
    members: [{ userId: req.user.id, role: 'admin' }],
    createdBy: req.user.id
  });
  
  // Add members with 'member' role
  if (memberIds && Array.isArray(memberIds)) {
    memberIds.forEach(userId => {
      group.members.push({ userId, role: 'member' });
    });
  }
  
  await group.save();
  res.json({ group });
});

app.get('/api/groups', authMiddleware, async (req, res) => {
  const groups = await Group.find({ 'members.userId': req.user.id })
    .populate('members.userId', 'username displayName avatar')
    .sort({ updatedAt: -1 });
  res.json({ groups });
});

app.get('/api/groups/:groupId', authMiddleware, async (req, res) => {
  const group = await Group.findOne({
    _id: req.params.groupId,
    'members.userId': req.user.id
  }).populate('members.userId', 'username displayName avatar');
  
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  res.json({ group });
});

app.put('/api/groups/:groupId', authMiddleware, async (req, res) => {
  const { name, description } = req.body;
  
  const group = await Group.findOne({
    _id: req.params.groupId,
    'members.userId': req.user.id,
    'members.role': 'admin'
  });
  
  if (!group) {
    return res.status(403).json({ error: 'Not authorized to update group' });
  }
  
  if (name) group.name = name;
  if (description !== undefined) group.description = description;
  
  await group.save();
  res.json({ group });
});

app.post('/api/groups/:groupId/members', authMiddleware, async (req, res) => {
  const { userId } = req.body;
  
  const group = await Group.findOne({
    _id: req.params.groupId,
    'members.userId': req.user.id,
    'members.role': 'admin'
  });
  
  if (!group) {
    return res.status(403).json({ error: 'Not authorized to add members' });
  }
  
  // Check if already a member
  const existingMember = group.members.find(m => m.userId.toString() === userId);
  if (existingMember) {
    return res.status(400).json({ error: 'User already in group' });
  }
  
  group.members.push({ userId, role: 'member' });
  await group.save();
  res.json({ group });
});

app.delete('/api/groups/:groupId/members/:userId', authMiddleware, async (req, res) => {
  const group = await Group.findOne({
    _id: req.params.groupId,
    'members.userId': req.user.id
  });
  
  if (!group) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  // Only admins can remove members, or user can leave themselves
  const isAdmin = group.members.find(m => 
    m.userId.toString() === req.user.id && m.role === 'admin'
  );
  const isSelf = req.params.userId === req.user.id;
  
  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'Not authorized to remove members' });
  }
  
  group.members = group.members.filter(
    m => m.userId.toString() !== req.params.userId
  );
  await group.save();
  res.json({ group });
});

app.delete('/api/groups/:groupId', authMiddleware, async (req, res) => {
  const group = await Group.findOne({
    _id: req.params.groupId,
    'members.userId': req.user.id,
    'members.role': 'admin'
  });
  
  if (!group) {
    return res.status(403).json({ error: 'Only admin can delete group' });
  }
  
  await Group.deleteOne({ _id: req.params.groupId });
  res.json({ success: true });
});

app.get('/api/groups/:groupId/messages', authMiddleware, async (req, res) => {
  // Verify user is a member of the group
  const group = await Group.findOne({
    _id: req.params.groupId,
    'members.userId': req.user.id
  });
  
  if (!group) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }
  
  const messages = await Message.find({ groupId: req.params.groupId })
    .populate('fromUserId', 'username displayName avatar')
    .sort({ createdAt: 1 });
  
  res.json({ messages, groupName: group.name });
});

app.post('/api/groups/:groupId/messages', authMiddleware, async (req, res) => {
  const { text, mediaType, mediaUrl, duration } = req.body;
  
  // Verify user is a member of the group
  const group = await Group.findOne({
    _id: req.params.groupId,
    'members.userId': req.user.id
  });
  
  if (!group) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }
  
  const message = new Message({
    fromUserId: req.user.id,
    groupId: req.params.groupId,
    text,
    mediaType,
    mediaUrl,
    duration
  });
  
  await message.save();
  
  // Update group's last message
  group.lastMessage = {
    text: text || `[${mediaType || 'message'}]`,
    senderId: req.user.id,
    createdAt: new Date()
  };
  await group.save();
  
  // Populate sender info
  await message.populate('fromUserId', 'username displayName avatar');
  
  // Emit to all group members via socket
  io.to(`group:${req.params.groupId}`).emit('group:message', {
    id: message._id.toString(),
    fromUserId: req.user.id,
    fromUsername: message.fromUserId.username,
    groupId: req.params.groupId,
    text,
    mediaType,
    mediaUrl,
    duration,
    createdAt: message.createdAt
  });
  
  res.json({ message });
});

app.get('/api/users', authMiddleware, async (req, res) => {
  const myId = new mongoose.Types.ObjectId(String(req.user.id));

  // Show only direct-message contacts for this user (private user list).
  const contacts = await Message.aggregate([
    {
      $match: {
        groupId: { $exists: false },
        toUserId: { $exists: true, $ne: null },
        $or: [{ fromUserId: myId }, { toUserId: myId }]
      }
    },
    {
      $project: {
        peerId: {
          $cond: [{ $eq: ['$fromUserId', myId] }, '$toUserId', '$fromUserId']
        },
        createdAt: 1
      }
    },
    { $match: { peerId: { $ne: myId } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$peerId',
        lastAt: { $first: '$createdAt' }
      }
    },
    { $sort: { lastAt: -1 } }
  ]);

  const contactIds = contacts.map((c) => c._id).filter(Boolean);
  if (!contactIds.length) {
    return res.json({ users: [] });
  }

  const users = await User.find({ _id: { $in: contactIds } }).select('-passwordHash');
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const ordered = contactIds.map((id) => byId.get(String(id))).filter(Boolean);

  res.json({ users: ordered.map(sanitizeUser) });
});

// Search for users by username or display name
app.get('/api/users/search', authMiddleware, async (req, res) => {
  const query = String(req.query.q || '').trim();
  const myId = req.user.id;
  
  if (!query || query.length < 2) {
    return res.json({ users: [] });
  }
  
  // Search by username or displayName (case-insensitive)
  const users = await User.find({
    _id: { $ne: myId },
    $or: [
      { username: { $regex: query, $options: 'i' } },
      { displayName: { $regex: query, $options: 'i' } }
    ]
  }).select('-passwordHash').limit(20);
  
  res.json({ users: users.map(sanitizeUser) });
});

app.get('/api/messages/:peerId', authMiddleware, async (req, res) => {
  const peerId = req.params.peerId;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const q = String(req.query.q || '').trim();

  const filter = {
    $or: [
      { fromUserId: req.user.id, toUserId: peerId },
      { fromUserId: peerId, toUserId: req.user.id }
    ]
  };
  if (before && !Number.isNaN(before.getTime())) {
    filter.createdAt = { $lt: before };
  }
  if (q) {
    filter.text = { $regex: q, $options: 'i' };
  }

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;
  page.reverse();

  // Populate user data
  const populatedMessages = await Message.populate(page, {
    path: 'fromUserId',
    select: 'username'
  });

  const normalized = populatedMessages.map((m) => ({
    id: m._id.toString(),
    fromUserId: typeof m.fromUserId === 'object' ? m.fromUserId._id.toString() : m.fromUserId.toString(),
    fromUsername: typeof m.fromUserId === 'object' ? m.fromUserId.username : 'User',
    toUserId: m.toUserId.toString(),
    text: m.text,
    mediaType: m.mediaType,
    mediaUrl: m.mediaUrl,
    duration: m.duration,
    createdAt: m.createdAt,
    deliveredAt: m.deliveredAt || null,
    readBy: m.readBy || [],
    reactions: m.reactions || [],
    replyTo: m.replyTo,
    forwarded: m.forwarded || false,
    edited: m.edited || false,
    deleted: m.deleted || false
  }));

  res.json({
    messages: normalized,
    hasMore,
    nextBefore: normalized.length ? normalized[0].createdAt : null
  });
});

app.get('/api/messages/:peerId/search', authMiddleware, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

  const matches = await Message.find({
    $or: [
      { fromUserId: req.user.id, toUserId: req.params.peerId },
      { fromUserId: req.params.peerId, toUserId: req.user.id }
    ],
    text: { $regex: q, $options: 'i' }
  })
    .sort({ createdAt: -1 })
    .limit(limit);

  res.json({
    messages: matches.map((m) => ({
      id: m._id.toString(),
      text: m.text,
      createdAt: m.createdAt
    }))
  });
});

// Message Reactions
app.post('/api/messages/:messageId/reaction', authMiddleware, async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'emoji is required' });
  
  const message = await Message.findById(req.params.messageId);
  if (!message) return res.status(404).json({ error: 'message not found' });
  
  // Check if user already reacted with this emoji
  const existingReaction = message.reactions.find(
    r => r.userId.toString() === req.user.id && r.emoji === emoji
  );
  
  if (existingReaction) {
    // Remove reaction
    message.reactions = message.reactions.filter(
      r => !(r.userId.toString() === req.user.id && r.emoji === emoji)
    );
  } else {
    // Remove any reaction from this user
    message.reactions = message.reactions.filter(r => r.userId.toString() !== req.user.id);
    // Add new reaction
    message.reactions.push({ userId: req.user.id, emoji });
  }
  
  await message.save();
  
  const fromUser = await User.findById(message.fromUserId).select('username');
  const normalized = formatMessage(message, fromUser?.username);
  
  // Notify both users
  const senderSocketId = onlineByUserId.get(req.user.id);
  if (senderSocketId) io.to(senderSocketId).emit('message_updated', normalized);
  const peerId = message.fromUserId.toString() === req.user.id ? message.toUserId.toString() : message.fromUserId.toString();
  const peerSocketId = onlineByUserId.get(peerId);
  if (peerSocketId) io.to(peerSocketId).emit('message_updated', normalized);
  
  res.json({ success: true, reactions: message.reactions });
});

// Edit Message
app.put('/api/messages/:messageId', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  
  const message = await Message.findById(req.params.messageId);
  if (!message) return res.status(404).json({ error: 'message not found' });
  if (message.fromUserId.toString() !== req.user.id) {
    return res.status(403).json({ error: 'can only edit your own messages' });
  }
  
  message.text = text.slice(0, 1000);
  message.edited = true;
  await message.save();
  
  const fromUser = await User.findById(message.fromUserId).select('username');
  const normalized = formatMessage(message, fromUser?.username);
  
  const senderSocketId = onlineByUserId.get(req.user.id);
  if (senderSocketId) io.to(senderSocketId).emit('message_updated', normalized);
  const peerSocketId = onlineByUserId.get(message.toUserId.toString());
  if (peerSocketId) io.to(peerSocketId).emit('message_updated', normalized);
  
  res.json({ success: true, message: normalized });
});

// Delete Message
app.delete('/api/messages/:messageId', authMiddleware, async (req, res) => {
  const { deleteForAll } = req.body;
  
  const message = await Message.findById(req.params.messageId);
  if (!message) return res.status(404).json({ error: 'message not found' });
  
  if (deleteForAll && message.fromUserId.toString() === req.user.id) {
    // Delete for everyone
    message.deleted = true;
    message.text = 'This message was deleted';
    message.mediaUrl = null;
    message.mediaType = null;
    await message.save();
    
    const fromUser = await User.findById(message.fromUserId).select('username');
    const normalized = formatMessage(message, fromUser?.username);
    
    const senderSocketId = onlineByUserId.get(req.user.id);
    if (senderSocketId) io.to(senderSocketId).emit('message_updated', normalized);
    const peerSocketId = onlineByUserId.get(message.toUserId.toString());
    if (peerSocketId) io.to(peerSocketId).emit('message_updated', normalized);
  } else {
    // Delete only for self
    if (!message.deletedFor.includes(req.user.id)) {
      message.deletedFor.push(req.user.id);
      await message.save();
    }
  }
  
  res.json({ success: true });
});

// Forward Message
app.post('/api/messages/:messageId/forward', authMiddleware, async (req, res) => {
  const { toUserId } = req.body;
  if (!toUserId) return res.status(400).json({ error: 'recipient userId is required' });
  
  const originalMessage = await Message.findById(req.params.messageId);
  if (!originalMessage) return res.status(404).json({ error: 'message not found' });
  
  const fromUser = await User.findById(req.user.id).select('username');
  const originalSender = await User.findById(originalMessage.fromUserId).select('username');
  
  // Create new message
  const newMessage = await Message.create({
    fromUserId: req.user.id,
    toUserId,
    text: originalMessage.text,
    mediaType: originalMessage.mediaType,
    mediaUrl: originalMessage.mediaUrl,
    duration: originalMessage.duration,
    forwarded: true,
    forwardedFrom: `@${originalSender?.username || 'unknown'}`
  });
  
  const normalized = formatMessage(newMessage, fromUser?.username);
  
  const senderSocketId = onlineByUserId.get(req.user.id);
  if (senderSocketId) io.to(senderSocketId).emit('message', normalized);
  const peerSocketId = onlineByUserId.get(toUserId);
  if (peerSocketId) io.to(peerSocketId).emit('message', normalized);
  
  res.json({ success: true, message: normalized });
});

// Pin/Unpin Message
app.post('/api/messages/:messageId/pin', authMiddleware, async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message) return res.status(404).json({ error: 'message not found' });
  
  // Only the sender or recipient can pin/unpin
  if (message.fromUserId.toString() !== req.user.id && message.toUserId.toString() !== req.user.id) {
    return res.status(403).json({ error: 'not authorized' });
  }
  
  message.pinned = !message.pinned;
  await message.save();
  
  const fromUser = await User.findById(message.fromUserId).select('username');
  const normalized = formatMessage(message, fromUser?.username);
  
  const senderSocketId = onlineByUserId.get(req.user.id);
  if (senderSocketId) io.to(senderSocketId).emit('message_updated', normalized);
  
  const peerId = message.fromUserId.toString() === req.user.id ? message.toUserId.toString() : message.fromUserId.toString();
  const peerSocketId = onlineByUserId.get(peerId);
  if (peerSocketId) io.to(peerSocketId).emit('message_updated', normalized);
  
  res.json({ success: true, pinned: message.pinned });
});

// Edit Message
app.put('/api/messages/:messageId', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text && text !== '') return res.status(400).json({ error: 'text is required' });
  
  const message = await Message.findById(req.params.messageId);
  if (!message) return res.status(404).json({ error: 'message not found' });
  
  // Only sender can edit
  if (message.fromUserId.toString() !== req.user.id) {
    return res.status(403).json({ error: 'not authorized' });
  }
  
  // Can't edit deleted messages
  if (message.deleted) {
    return res.status(400).json({ error: 'cannot edit deleted message' });
  }
  
  message.text = text;
  message.edited = true;
  await message.save();
  
  const fromUser = await User.findById(message.fromUserId).select('username');
  const normalized = formatMessage(message, fromUser?.username);
  
  // Emit to sender
  const senderSocketId = onlineByUserId.get(req.user.id);
  if (senderSocketId) io.to(senderSocketId).emit('message_updated', normalized);
  
  // Emit to recipient
  const peerId = message.toUserId.toString();
  const peerSocketId = onlineByUserId.get(peerId);
  if (peerSocketId) io.to(peerSocketId).emit('message_updated', normalized);
  
  res.json({ success: true, message: normalized });
});

// Typing Indicator
app.post('/api/messages/:peerId/typing', authMiddleware, async (req, res) => {
  const { isTyping } = req.body;
  
  const peerSocketId = onlineByUserId.get(req.params.peerId);
  if (peerSocketId) {
    io.to(peerSocketId).emit('user_typing', {
      userId: req.user.id,
      username: req.user.username,
      isTyping: Boolean(isTyping)
    });
  }
  
  res.json({ success: true });
});

// Helper function to format messages
function formatMessage(message, fromUsername) {
  return {
    id: message._id.toString(),
    fromUserId: message.fromUserId.toString(),
    fromUsername: fromUsername || 'unknown',
    toUserId: message.toUserId.toString(),
    text: message.deleted ? 'This message was deleted' : message.text,
    mediaType: message.mediaType,
    mediaUrl: message.mediaUrl,
    duration: message.duration,
    reactions: message.reactions || [],
    replyTo: message.replyTo,
    forwarded: message.forwarded || false,
    forwardedFrom: message.forwardedFrom,
    edited: message.edited || false,
    deleted: message.deleted || false,
    createdAt: message.createdAt,
    deliveredAt: message.deliveredAt || null,
    readBy: message.readBy || []
  };
}

app.post('/api/reels', authMiddleware, upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'video file is required (field: video)' });

  const caption = normalizeCaption(req.body.caption || '');
  const reel = await Reel.create({
    userId: req.user.id,
    caption,
    sourceVideoUrl: `/uploads/original/${req.file.filename}`,
    status: 'PROCESSING'
  });

  io.emit('reel_updated', { reelId: reel._id.toString(), status: reel.status, reason: null });

  enqueueReel(reel._id.toString()).catch(async (err) => {
    await Reel.findByIdAndUpdate(reel._id, {
      status: 'FAILED',
      moderationReason: err.message.slice(0, 160)
    });
    io.emit('reel_updated', { reelId: reel._id.toString(), status: 'FAILED', reason: 'queue processing failed' });
  });

  const formatted = await formatReel(reel);
  return res.status(201).json({ reel: formatted });
});

app.get('/api/reels', authMiddleware, async (_req, res) => {
  const reels = await Reel.find({ status: 'READY' })
    .sort({ createdAt: -1 });
  
  const formatted = await Promise.all(reels.map(formatReel));
  res.json({ reels: formatted });
});

app.get('/api/reels/mine', authMiddleware, async (req, res) => {
  const reels = await Reel.find({ userId: req.user.id })
    .sort({ createdAt: -1 });
  
  const formatted = await Promise.all(reels.map(formatReel));
  res.json({ reels: formatted });
});

app.post('/api/reels/:reelId/like', authMiddleware, async (req, res) => {
  const reel = await Reel.findById(req.params.reelId);
  if (!reel) return res.status(404).json({ error: 'reel not found' });
  if (reel.status !== 'READY') return res.status(400).json({ error: 'reel is not ready yet' });

  reel.likes += 1;
  await reel.save();

  io.emit('reel_liked', { reelId: reel._id.toString(), likes: reel.likes });
  
  const formatted = await formatReel(reel);
  res.json({ reel: formatted });
});

// Stories API
app.post('/api/stories', authMiddleware, storyUpload.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'media file is required' });

  const user = await User.findById(req.user.id).select('username');
  const username = user?.username || req.user.username || 'user';
  
  // Validate media type by checking both mimetype and extension
  const ext = path.extname(req.file.originalname || '').toLowerCase();
  const mimetype = req.file.mimetype || '';
  const isVideoByMime = mimetype.startsWith('video/');
  const isImageByMime = mimetype.startsWith('image/');
  const isVideoExt = /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(ext);
  const isImageExt = /\.(jpg|jpeg|png|gif|webp)(\?|#|$)/i.test(ext);
  
  // Determine if it's a video: must be video mimetype AND video extension
  const isVideo = isVideoByMime && isVideoExt;
  // Allow image if: (image mimetype with any ext) OR (video mimetype but image ext - use image)
  const isImage = isImageByMime || (mimetype.startsWith('video/') && isImageExt);
  
  if (!isVideo && !isImage) {
    // Clean up the uploaded file
    try { await fs.promises.unlink(req.file.path).catch(() => null); } catch {}
    return res.status(400).json({ error: 'Invalid file type. Must be an image or video file.' });
  }

  let mediaUrl = `/uploads/stories/${req.file.filename}`;
  let mediaType = isVideo ? 'video' : 'image';
  let gridFsFileId = null;

  // Upload to GridFS for persistence
  if (mongoStorage.isGridFSReady()) {
    try {
      const filePath = path.join(UPLOAD_DIR, 'stories', req.file.filename);
      const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
      const result = await mongoStorage.uploadToGridFS(filePath, req.file.filename, contentType);
      gridFsFileId = result.id;
      mediaUrl = result.url; // Use GridFS URL
      console.log('Story media uploaded to GridFS:', result.id);
    } catch (err) {
      console.error('GridFS upload failed, using local storage:', err);
    }
  }

  if (isVideo) {
    const hasFfmpeg = await checkBinary('ffmpeg');
    if (!hasFfmpeg) {
      // Graceful fallback: keep original uploaded video if ffmpeg is unavailable.
      console.warn('ffmpeg missing, skipping story transcode and using original upload');
    } else {
      const inputPath = path.join(UPLOAD_DIR, 'stories', req.file.filename);
      const baseName = path.basename(req.file.filename, path.extname(req.file.filename));
      const outputName = `${baseName}.mp4`;
      const outputPath = path.join(UPLOAD_DIR, 'stories', outputName);

      try {
        await transcodeStoryToMp4(inputPath, outputPath);
        await fs.promises.unlink(inputPath).catch(() => null);
        mediaUrl = `/uploads/stories/${outputName}`;
        mediaType = 'video';

        // Upload transcoded video to GridFS
        if (mongoStorage.isGridFSReady() && gridFsFileId) {
          try {
            await mongoStorage.deleteFromGridFS(gridFsFileId); // Delete original
            const result = await mongoStorage.uploadToGridFS(outputPath, outputName, 'video/mp4');
            gridFsFileId = result.id;
            mediaUrl = result.url;
            await fs.promises.unlink(outputPath).catch(() => null);
            console.log('Transcoded video uploaded to GridFS:', result.id);
          } catch (err) {
            console.error('GridFS upload for transcoded video failed:', err);
            mediaUrl = `/uploads/stories/${outputName}`;
          }
        }
      } catch (err) {
        // Graceful fallback: keep original uploaded video on transcode failure.
        console.error('Story transcode failed, using original upload:', err);
      }
    }
  }

  const story = new Story({
    userId: req.user.id,
    username: username,
    mediaUrl,
    mediaType,
    caption: req.body.caption || ''
  });

  await story.save();

  io.emit('new_story', {
    id: story._id.toString(),
    userId: story.userId.toString(),
    username: story.username,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    caption: story.caption,
    createdAt: story.createdAt,
    viewsCount: 0,
    reactions: [],
    isHighlight: false
  });

  return res.status(201).json({ story: {
    id: story._id.toString(),
    userId: story.userId.toString(),
    username: story.username,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    caption: story.caption,
    createdAt: story.createdAt,
    viewsCount: 0,
    reactions: [],
    isHighlight: false
  }});
});

app.get('/api/stories', authMiddleware, async (req, res) => {
  const now = new Date();
  const stories = await Story.find({
    userId: { $ne: req.user.id },
    expiresAt: { $gt: now }
  }).sort({ createdAt: -1 });

  const populated = await Story.populate(stories, { path: 'userId', select: 'username' });
  
  res.json({ stories: populated.map(s => ({
    id: s._id.toString(),
    userId: s.userId._id.toString(),
    username: s.userId.username,
    mediaUrl: s.mediaUrl,
    mediaType: s.mediaType,
    caption: s.caption,
    createdAt: s.createdAt,
    viewed: s.viewed || [],
    viewsCount: s.viewed?.length || 0,
    reactions: s.reactions || [],
    isHighlight: s.isHighlight || false
  }))});
});

app.get('/api/stories/mine', authMiddleware, async (req, res) => {
  const now = new Date();
  const stories = await Story.find({
    userId: req.user.id,
    expiresAt: { $gt: now }
  }).sort({ createdAt: -1 });

  res.json({ stories: stories.map(s => ({
    id: s._id.toString(),
    userId: s.userId.toString(),
    username: s.username,
    mediaUrl: s.mediaUrl,
    mediaType: s.mediaType,
    caption: s.caption,
    createdAt: s.createdAt,
    viewed: s.viewed || [],
    viewsCount: s.viewed?.length || 0,
    reactions: s.reactions || [],
    isHighlight: s.isHighlight || false,
    highlightTitle: s.highlightTitle
  }))});
});

app.post('/api/stories/:storyId/view', authMiddleware, async (req, res) => {
  const story = await Story.findById(req.params.storyId);
  if (!story) return res.status(404).json({ error: 'story not found' });

  if (!story.viewed.includes(req.user.id)) {
    story.viewed.push(req.user.id);
    await story.save();
    
    // Notify story owner if someone viewed their story
    const ownerSocketId = onlineByUserId.get(story.userId.toString());
    if (ownerSocketId) {
      io.to(ownerSocketId).emit('story_viewed', {
        storyId: story._id.toString(),
        viewerId: req.user.id,
        viewedCount: story.viewed.length
      });
    }
  }

  res.json({ success: true });
});

// Story Reactions
app.post('/api/stories/:storyId/react', authMiddleware, async (req, res) => {
  const { emoji } = req.body;
  const story = await Story.findById(req.params.storyId);
  if (!story) return res.status(404).json({ error: 'story not found' });

  // Remove existing reaction from this user
  story.reactions = story.reactions.filter(r => r.userId.toString() !== req.user.id);
  
  // Add new reaction
  story.reactions.push({
    userId: req.user.id,
    username: req.user.username,
    emoji: emoji || '❤️'
  });
  
  await story.save();

  // Notify story owner
  const ownerSocketId = onlineByUserId.get(story.userId.toString());
  if (ownerSocketId && story.userId.toString() !== req.user.id) {
    io.to(ownerSocketId).emit('story_reaction', {
      storyId: story._id.toString(),
      reaction: story.reactions[story.reactions.length - 1]
    });
  }

  res.json({ success: true, reactions: story.reactions });
});

// Story Replies
app.post('/api/stories/:storyId/reply', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'reply text is required' });

  const story = await Story.findById(req.params.storyId);
  if (!story) return res.status(404).json({ error: 'story not found' });

  const reply = {
    fromUserId: req.user.id,
    fromUsername: req.user.username,
    text: text.trim().slice(0, 200)
  };
  
  story.replies.push(reply);
  await story.save();

  // Notify story owner about the reply
  const ownerSocketId = onlineByUserId.get(story.userId.toString());
  if (ownerSocketId) {
    io.to(ownerSocketId).emit('story_reply', {
      storyId: story._id.toString(),
      reply: {
        ...reply,
        id: story.replies[story.replies.length - 1]._id.toString(),
        createdAt: reply.createdAt
      }
    });
  }

  res.json({ success: true, reply });
});

// Toggle Story Highlight
app.post('/api/stories/:storyId/highlight', authMiddleware, async (req, res) => {
  const { title } = req.body;
  
  const story = await Story.findOne({ _id: req.params.storyId, userId: req.user.id });
  if (!story) return res.status(404).json({ error: 'story not found' });

  story.isHighlight = !story.isHighlight;
  if (title && story.isHighlight) {
    story.highlightTitle = title.trim().slice(0, 30);
  }
  await story.save();

  res.json({ success: true, isHighlight: story.isHighlight });
});

// Get Story Highlights
app.get('/api/stories/highlights', authMiddleware, async (req, res) => {
  const highlights = await Story.find({ 
    userId: req.user.id, 
    isHighlight: true 
  }).sort({ createdAt: -1 });

  res.json({ stories: highlights.map(s => ({
    id: s._id.toString(),
    userId: s.userId.toString(),
    username: s.username,
    mediaUrl: s.mediaUrl,
    mediaType: s.mediaType,
    caption: s.caption,
    highlightTitle: s.highlightTitle,
    createdAt: s.createdAt,
    viewsCount: s.viewed.length
  }))});
});

// Get Story Viewers
app.get('/api/stories/:storyId/viewers', authMiddleware, async (req, res) => {
  const story = await Story.findById(req.params.storyId);
  if (!story) return res.status(404).json({ error: 'story not found' });
  
  // Only story owner can see viewers
  if (story.userId.toString() !== req.user.id) {
    return res.status(403).json({ error: 'not authorized' });
  }

  const viewers = await User.find({ _id: { $in: story.viewed } }).select('username displayName avatar');
  
  res.json({ viewers: viewers.map(v => ({
    id: v._id.toString(),
    username: v.username,
    displayName: v.displayName || v.username,
    avatarUrl: v.avatarUrl || ''
  }))});
});

app.delete('/api/stories/:storyId', authMiddleware, async (req, res) => {
  const story = await Story.findOne({ _id: req.params.storyId, userId: req.user.id });
  if (!story) return res.status(404).json({ error: 'story not found' });

  await Story.deleteOne({ _id: req.params.storyId });
  res.json({ success: true });
});

// Call Logs API
app.get('/api/calls', authMiddleware, async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  
  const filter = {
    $or: [{ callerId: req.user.id }, { calleeId: req.user.id }]
  };
  
  if (type) {
    filter.status = type;
  }
  
  const calls = await CallLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit))
    .lean();
  
  const total = await CallLog.countDocuments(filter);
  
  // Transform for frontend
  const transformedCalls = calls.map(call => ({
    id: call._id.toString(),
    peerId: call.callerId.toString() === req.user.id ? call.calleeId.toString() : call.callerId.toString(),
    peerUsername: call.callerId.toString() === req.user.id ? call.calleeUsername : call.callerUsername,
    peerAvatar: '', // Will be populated by frontend if needed
    type: call.type,
    status: call.status,
    duration: call.duration,
    startedAt: call.startedAt,
    isOutgoing: call.callerId.toString() === req.user.id
  }));
  
  res.json({ calls: transformedCalls, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

app.post('/api/calls/log', authMiddleware, async (req, res) => {
  const { peerId, peerUsername, type, status, duration } = req.body;
  
  if (!peerId || !type || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const callLog = new CallLog({
    callerId: req.user.id,
    callerUsername: req.user.username,
    calleeId: peerId,
    calleeUsername: peerUsername,
    type,
    status,
    duration: duration || 0,
    endedAt: status !== 'missed' ? new Date() : undefined
  });
  
  await callLog.save();
  
  res.json({ success: true, id: callLog._id.toString() });
});

app.put('/api/calls/:callId/duration', authMiddleware, async (req, res) => {
  const { duration } = req.body;
  
  const callLog = await CallLog.findOne({
    _id: req.params.callId,
    $or: [{ callerId: req.user.id }, { calleeId: req.user.id }]
  });
  
  if (!callLog) return res.status(404).json({ error: 'Call log not found' });
  
  callLog.duration = duration;
  callLog.endedAt = new Date();
  await callLog.save();
  
  res.json({ success: true });
});

app.delete('/api/calls/:callId', authMiddleware, async (req, res) => {
  const callLog = await CallLog.findOne({
    _id: req.params.callId,
    $or: [{ callerId: req.user.id }, { calleeId: req.user.id }]
  });
  
  if (!callLog) return res.status(404).json({ error: 'Call log not found' });
  
  await CallLog.deleteOne({ _id: req.params.callId });
  res.json({ success: true });
});

// Comments API
app.get('/api/reels/:reelId/comments', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  const comments = await Comment.find({ reelId: req.params.reelId })
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit))
    .lean();
  
  const total = await Comment.countDocuments({ reelId: req.params.reelId });
  
  res.json({ comments, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

app.post('/api/reels/:reelId/comments', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text is required' });
  
  const reel = await Reel.findById(req.params.reelId);
  if (!reel) return res.status(404).json({ error: 'Reel not found' });
  
  const comment = await Comment.create({
    userId: req.user.id,
    username: req.user.username,
    reelId: req.params.reelId,
    text: text.trim()
  });
  
  res.json({ 
    id: comment._id.toString(),
    userId: comment.userId.toString(),
    username: comment.username,
    reelId: comment.reelId.toString(),
    text: comment.text,
    createdAt: comment.createdAt
  });
});

app.delete('/api/comments/:commentId', authMiddleware, async (req, res) => {
  const comment = await Comment.findOne({
    _id: req.params.commentId,
    userId: req.user.id
  });
  
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  
  await Comment.deleteOne({ _id: req.params.commentId });
  res.json({ success: true });
});

// ============================================
// Posts API
// ============================================

// Extract hashtags from text
function extractHashtags(text) {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.map(h => h.slice(1).toLowerCase()) : [];
}

// Calculate engagement score for ranking
function calculateEngagementScore(post) {
  const likesWeight = 1;
  const commentsWeight = 2;
  const sharesWeight = 3;
  const savesWeight = 3;
  
  const baseScore = (
    (post.likesCount || 0) * likesWeight +
    (post.commentsCount || 0) * commentsWeight +
    (post.sharesCount || 0) * sharesWeight +
    (post.savesCount || 0) * savesWeight
  );
  
  // Recency factor (newer posts rank higher)
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
  const recencyFactor = Math.max(0.1, 1 - (ageHours / 168)); // Decay over 1 week
  
  return baseScore * recencyFactor;
}

function postLikedByUser(post, userId) {
  return Array.isArray(post?.likes) && post.likes.some((id) => String(id) === String(userId));
}

function buildPostTrendPipeline({ userId, excludeOwn = false, skip = 0, limit = 20, lookbackDays = 45 }) {
  const match = {
    isHidden: false,
    isArchived: false
  };

  if (excludeOwn && userId) {
    match.userId = { $ne: new mongoose.Types.ObjectId(String(userId)) };
  }

  if (lookbackDays > 0) {
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    match.createdAt = { $gte: since };
  }

  return [
    { $match: match },
    {
      $addFields: {
        ageHours: {
          $max: [
            0,
            { $divide: [{ $subtract: [new Date(), '$createdAt'] }, 1000 * 60 * 60] }
          ]
        },
        engagementRaw: {
          $add: [
            { $multiply: [{ $ifNull: ['$likesCount', 0] }, 1.0] },
            { $multiply: [{ $ifNull: ['$commentsCount', 0] }, 2.2] },
            { $multiply: [{ $ifNull: ['$sharesCount', 0] }, 3.0] },
            { $multiply: [{ $ifNull: ['$savesCount', 0] }, 3.4] }
          ]
        },
        mediaCount: { $size: { $ifNull: ['$media', []] } },
        videoCount: {
          $size: {
            $filter: {
              input: { $ifNull: ['$media', []] },
              as: 'm',
              cond: { $eq: ['$$m.type', 'video'] }
            }
          }
        },
        hashtagCount: { $size: { $ifNull: ['$hashtags', []] } }
      }
    },
    {
      $addFields: {
        recencyScore: {
          $multiply: [42, { $exp: { $multiply: [-1, { $divide: ['$ageHours', 84] }] } }]
        },
        engagementScoreV2: { $multiply: [20, { $ln: { $add: ['$engagementRaw', 1] } }] },
        velocityScore: {
          $multiply: [2.1, { $divide: ['$engagementRaw', { $max: ['$ageHours', 1] }] }]
        },
        mediaScore: {
          $add: [
            { $cond: [{ $gt: ['$mediaCount', 1] }, 2.5, 0] },
            { $cond: [{ $gt: ['$videoCount', 0] }, 1.8, 0] },
            { $min: ['$hashtagCount', 3] }
          ]
        }
      }
    },
    {
      $addFields: {
        trendScore: {
          $add: ['$recencyScore', '$engagementScoreV2', '$velocityScore', '$mediaScore']
        }
      }
    },
    { $sort: { trendScore: -1, engagementRaw: -1, createdAt: -1 } },
    { $skip: skip },
    { $limit: limit }
  ];
}

async function attachPostFlags(posts, userId) {
  if (!posts.length) return posts;

  const postIds = posts.map((post) => post._id);
  const saves = await Save.find({ userId, postId: { $in: postIds } }).select('postId');
  const savedSet = new Set(saves.map((save) => String(save.postId)));

  return posts.map((post) => ({
    ...post,
    isLiked: postLikedByUser(post, userId),
    isSaved: savedSet.has(String(post._id))
  }));
}

// Create post
app.post('/api/posts', authMiddleware, upload.array('media', 10), async (req, res) => {
  const { caption, location, taggedUsers } = req.body || {};
  const files = req.files || [];
  
  if (files.length === 0) {
    return res.status(400).json({ error: 'At least one media file is required' });
  }
  
  const media = files.map(f => ({
    type: f.mimetype.startsWith('video') ? 'video' : 'image',
    url: `/uploads/original/${f.filename}`,
    width: 0,
    height: 0
  }));
  
  const locationObj = location ? JSON.parse(location) : {};
  const hashtags = extractHashtags(caption || '');
  
  const post = await Post.create({
    userId: req.user.id,
    username: req.user.username,
    caption: caption || '',
    media,
    location: locationObj.name ? locationObj : undefined,
    hashtags,
    taggedUsers: taggedUsers ? JSON.parse(taggedUsers) : []
  });
  
  // Update engagement score
  post.engagementScore = calculateEngagementScore(post);
  await post.save();
  
  res.status(201).json({ post });
});

// Get timeline feed
app.get('/api/posts/timeline', authMiddleware, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // Include own posts plus others' posts in timeline.
  const timelineFilter = {
    isHidden: false,
    isArchived: false
  };

  // For now, get all visible posts sorted by engagement.
  const posts = await Post.find(timelineFilter)
  .sort({ engagementScore: -1, createdAt: -1 })
  .skip(skip)
  .limit(Number(limit))
  .populate('userId', 'username displayName avatarUrl');
  
  // Add isLiked and isSaved flags
  const postsWithFlags = await Promise.all(posts.map(async (post) => {
    const isLiked = postLikedByUser(post, req.user.id);
    const isSaved = await Save.findOne({ userId: req.user.id, postId: post._id });
    return {
      ...post.toObject(),
      isLiked,
      isSaved: !!isSaved
    };
  }));
  
  const total = await Post.countDocuments(timelineFilter);
  
  res.json({ posts: postsWithFlags, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// Get user's posts
app.get('/api/posts/user/:userId', authMiddleware, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  
  const posts = await Post.find({ 
    userId: req.params.userId,
    isArchived: false,
    isHidden: false
  })
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(Number(limit));
  
  const postsWithFlags = await Promise.all(posts.map(async (post) => {
    const isLiked = postLikedByUser(post, req.user.id);
    const isSaved = await Save.findOne({ userId: req.user.id, postId: post._id });
    return {
      ...post.toObject(),
      isLiked,
      isSaved: !!isSaved
    };
  }));
  
  res.json({ posts: postsWithFlags });
});

// Like/unlike post
app.post('/api/posts/:postId/like', authMiddleware, async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  const likedIndex = post.likes.findIndex((id) => String(id) === String(req.user.id));
  let isLiked;
  
  if (likedIndex === -1) {
    post.likes.push(req.user.id);
    post.likesCount = (post.likesCount || 0) + 1;
    isLiked = true;
  } else {
    post.likes.splice(likedIndex, 1);
    post.likesCount = Math.max(0, (post.likesCount || 0) - 1);
    isLiked = false;
  }
  
  post.engagementScore = calculateEngagementScore(post);
  await post.save();
  
  io.emit('post_liked', { postId: post._id.toString(), likesCount: post.likesCount, isLiked });
  
  res.json({ post: { ...post.toObject(), isLiked } });
});

// Save/unsave post
app.post('/api/posts/:postId/save', authMiddleware, async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  const existingSave = await Save.findOne({ userId: req.user.id, postId: post._id });
  let isSaved;
  
  if (existingSave) {
    await Save.deleteOne({ _id: existingSave._id });
    post.savesCount = Math.max(0, (post.savesCount || 0) - 1);
    isSaved = false;
  } else {
    await Save.create({ userId: req.user.id, postId: post._id });
    post.savesCount = (post.savesCount || 0) + 1;
    isSaved = true;
  }
  
  post.engagementScore = calculateEngagementScore(post);
  await post.save();
  
  res.json({ post: { ...post.toObject(), isSaved } });
});

// Get saved posts
app.get('/api/posts/saved', authMiddleware, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  
  const saves = await Save.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate({
      path: 'postId',
      match: { isArchived: false, isHidden: false }
    });
  
  const posts = saves
    .filter(s => s.postId)
    .map(s => ({
      ...s.postId.toObject(),
      isLiked: postLikedByUser(s.postId, req.user.id),
      isSaved: true
    }));
  
  res.json({ posts });
});

// Delete post
app.delete('/api/posts/:postId', authMiddleware, async (req, res) => {
  const post = await Post.findOne({ 
    _id: req.params.postId, 
    userId: req.user.id 
  });
  
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  await Post.deleteOne({ _id: req.params.postId });
  await PostComment.deleteMany({ postId: req.params.postId });
  await Save.deleteMany({ postId: req.params.postId });
  
  res.json({ success: true });
});

// ============================================
// Post Comments API
// ============================================

app.get('/api/posts/:postId/comments', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  const comments = await PostComment.find({ postId: req.params.postId, replyTo: null })
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate('userId', 'username avatarUrl');
  
  // Get replies for each comment
  const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
    const replies = await PostComment.find({ replyTo: comment._id })
      .sort({ createdAt: 1 })
      .populate('userId', 'username avatarUrl');
    return {
      ...comment.toObject(),
      replies: replies.map(r => r.toObject())
    };
  }));
  
  res.json({ comments: commentsWithReplies });
});

app.post('/api/posts/:postId/comments', authMiddleware, async (req, res) => {
  const { text, replyTo } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text is required' });
  
  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  const comment = await PostComment.create({
    postId: req.params.postId,
    userId: req.user.id,
    username: req.user.username,
    text: text.trim(),
    replyTo: replyTo || null
  });
  
  post.commentsCount = (post.commentsCount || 0) + 1;
  post.engagementScore = calculateEngagementScore(post);
  await post.save();
  
  const populatedComment = await PostComment.findById(comment._id)
    .populate('userId', 'username avatarUrl');
  
  io.emit('post_comment', { postId: post._id.toString(), commentsCount: post.commentsCount });
  
  res.status(201).json({ comment: populatedComment });
});

// ============================================
// Explore / Search / Trending API
// ============================================

// Explore feed (algorithmic content discovery)
app.get('/api/explore', authMiddleware, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 60);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const pipeline = buildPostTrendPipeline({
    userId: req.user.id,
    excludeOwn: true,
    skip,
    limit: safeLimit
  });
  let rankedPosts = await Post.aggregate(pipeline);

  // Fallback: in low-activity environments (single user/dev), include own posts.
  if (!rankedPosts.length) {
    const fallbackPipeline = buildPostTrendPipeline({
      userId: req.user.id,
      excludeOwn: false,
      skip,
      limit: safeLimit
    });
    rankedPosts = await Post.aggregate(fallbackPipeline);
  }

  const postsWithFlags = await attachPostFlags(rankedPosts, req.user.id);
  
  res.json({ posts: postsWithFlags, page: safePage, limit: safeLimit });
});

// Search
app.get('/api/search', authMiddleware, async (req, res) => {
  const { q, type = 'all', page = 1, limit = 20 } = req.query;
  
  if (!q || !q.trim()) return res.status(400).json({ error: 'Search query is required' });
  
  const query = q.trim().toLowerCase();
  const skip = (Number(page) - 1) * Number(limit);
  const results = {};
  
  // Search users
  if (type === 'all' || type === 'users') {
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: req.user.id }
    })
    .select('username displayName avatarUrl description')
    .limit(Number(limit));
    results.users = users;
  }
  
  // Search posts by hashtags
  if (type === 'all' || type === 'posts') {
    const posts = await Post.find({
      hashtags: query,
      isHidden: false,
      isArchived: false
    })
    .sort({ engagementScore: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate('userId', 'username displayName avatarUrl');
    
    const postsWithFlags = await Promise.all(posts.map(async (post) => {
      const isLiked = postLikedByUser(post, req.user.id);
      const isSaved = await Save.findOne({ userId: req.user.id, postId: post._id });
      return {
        ...post.toObject(),
        isLiked,
        isSaved: !!isSaved
      };
    }));
    results.posts = postsWithFlags;
  }
  
  // Search by location
  if (type === 'all' || type === 'location') {
    const locationPosts = await Post.find({
      'location.name': { $regex: query, $options: 'i' },
      isHidden: false,
      isArchived: false
    })
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate('userId', 'username displayName avatarUrl');
    
    const locPostsWithFlags = await Promise.all(locationPosts.map(async (post) => {
      const isLiked = postLikedByUser(post, req.user.id);
      const isSaved = await Save.findOne({ userId: req.user.id, postId: post._id });
      return {
        ...post.toObject(),
        isLiked,
        isSaved: !!isSaved
      };
    }));
    results.locationPosts = locPostsWithFlags;
  }
  
  res.json(results);
});

// Trending hashtags
app.get('/api/trending/hashtags', authMiddleware, async (req, res) => {
  const { limit = 10 } = req.query;
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 30);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Weighted hashtag trend score using engagement and recency.
  const trending = await Post.aggregate([
    { $match: { isHidden: false, isArchived: false, createdAt: { $gte: since } } },
    { $unwind: '$hashtags' },
    {
      $addFields: {
        ageHours: {
          $max: [
            0,
            { $divide: [{ $subtract: [new Date(), '$createdAt'] }, 1000 * 60 * 60] }
          ]
        },
        baseEngagement: {
          $add: [
            { $multiply: [{ $ifNull: ['$likesCount', 0] }, 1.0] },
            { $multiply: [{ $ifNull: ['$commentsCount', 0] }, 2.2] },
            { $multiply: [{ $ifNull: ['$sharesCount', 0] }, 3.0] },
            { $multiply: [{ $ifNull: ['$savesCount', 0] }, 3.4] }
          ]
        }
      }
    },
    {
      $addFields: {
        trendContribution: {
          $multiply: [
            { $add: ['$baseEngagement', 1] },
            { $exp: { $multiply: [-1, { $divide: ['$ageHours', 120] }] } }
          ]
        }
      }
    },
    { $group: { _id: '$hashtags', count: { $sum: 1 }, score: { $sum: '$trendContribution' } } },
    { $sort: { score: -1, count: -1 } },
    { $limit: safeLimit }
  ]);
  
  res.json({
    hashtags: trending.map((t) => ({
      tag: t._id,
      count: t.count,
      score: Math.round(t.score * 100) / 100
    }))
  });
});

// Trending posts
app.get('/api/trending/posts', authMiddleware, async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const pipeline = buildPostTrendPipeline({
    userId: req.user.id,
    excludeOwn: false,
    skip,
    limit: safeLimit
  });
  const rankedPosts = await Post.aggregate(pipeline);
  const postsWithFlags = await attachPostFlags(rankedPosts, req.user.id);
  
  res.json({ posts: postsWithFlags, page: safePage, limit: safeLimit });
});

// Suggested users to follow
app.get('/api/suggested/users', authMiddleware, async (req, res) => {
  const { limit = 10 } = req.query;
  
  // Get users with most posts who aren't already followed
  const users = await User.find({ _id: { $ne: req.user.id } })
    .select('username displayName avatarUrl description')
    .limit(Number(limit));
  
  res.json({ users });
});

// Get posts by hashtag
app.get('/api/hashtag/:tag', authMiddleware, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const tag = req.params.tag.toLowerCase();
  
  const posts = await Post.find({ 
    hashtags: tag,
    isHidden: false,
    isArchived: false
  })
  .sort({ engagementScore: -1, createdAt: -1 })
  .skip(skip)
  .limit(Number(limit))
  .populate('userId', 'username displayName avatarUrl');
  
  const postsWithFlags = await Promise.all(posts.map(async (post) => {
    const isLiked = postLikedByUser(post, req.user.id);
    const isSaved = await Save.findOne({ userId: req.user.id, postId: post._id });
    return {
      ...post.toObject(),
      isLiked,
      isSaved: !!isSaved
    };
  }));
  
  res.json({ posts: postsWithFlags, tag });
});

// Share post to story
app.post('/api/posts/:postId/share-to-story', authMiddleware, async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  // Share first media item as-is (image or video).
  const mediaItem = post.media[0];
  if (!mediaItem) return res.status(400).json({ error: 'No media to share' });
  
  const story = await Story.create({
    userId: req.user.id,
    username: req.user.username,
    mediaUrl: mediaItem.url,
    mediaType: mediaItem.type === 'video' ? 'video' : 'image',
    caption: `Shared from @${post.username}: ${post.caption?.slice(0, 100) || ''}`
  });
  
  post.sharesCount = (post.sharesCount || 0) + 1;
  post.engagementScore = calculateEngagementScore(post);
  await post.save();
  
  io.emit('new_story', story);
  
  res.status(201).json({ story });
});

// Get reels for search
app.get('/api/search/reels', authMiddleware, async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  
  if (!q || !q.trim()) return res.status(400).json({ error: 'Search query is required' });
  
  const query = q.trim().toLowerCase();
  const skip = (Number(page) - 1) * Number(limit);
  
  const reels = await Reel.find({ 
    status: 'READY',
    caption: { $regex: query, $options: 'i' }
  })
  .sort({ likes: -1, createdAt: -1 })
  .skip(skip)
  .limit(Number(limit));
  
  res.json({ reels });
});

// ============================================
// Ads / Post Boosting
// ============================================

// Boost a post (create ad)
app.post('/api/posts/:postId/boost', authMiddleware, async (req, res) => {
  const { budget, dailyBudget, title, description, callToAction, targetInterests, startDate, endDate } = req.body || {};
  
  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  // Verify ownership
  if (post.userId.toString() !== req.user.id) {
    return res.status(403).json({ error: 'You can only boost your own posts' });
  }
  
  if (!budget || budget < 100) {
    return res.status(400).json({ error: 'Minimum budget is $1.00' });
  }
  
  const ad = await Ad.create({
    userId: req.user.id,
    postId: post._id,
    title: title || '',
    description: description || '',
    callToAction: callToAction || 'none',
    budget: Math.round(budget * 100), // Convert to cents
    dailyBudget: dailyBudget ? Math.round(dailyBudget * 100) : undefined,
    targetInterests: targetInterests || [],
    startDate: startDate || new Date(),
    endDate: endDate || null,
    status: 'active'
  });
  
  // Mark post as boosted
  post.engagementScore += 1000; // Boost score
  await post.save();
  
  res.status(201).json({ ad });
});

// Get user's ads
app.get('/api/ads/mine', authMiddleware, async (req, res) => {
  const ads = await Ad.find({ userId: req.user.id })
    .populate('postId')
    .sort({ createdAt: -1 });
  
  res.json({ ads });
});

// Get active sponsored posts for feed
app.get('/api/ads/feed', authMiddleware, async (req, res) => {
  const { page = 1, limit = 5 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  
  const ads = await Ad.find({ 
    status: 'active',
    startDate: { $lte: new Date() },
    $or: [
      { endDate: null },
      { endDate: { $gte: new Date() } }
    ]
  })
  .populate({
    path: 'postId',
    match: { isHidden: false, isArchived: false }
  })
  .sort({ budget: -1 }) // Higher budget = more visibility
  .skip(skip)
  .limit(Number(limit));
  
  // Filter out ads where post was removed
  const validAds = ads.filter(a => a.postId);
  
  const sponsoredPosts = validAds.map(ad => ({
    ...ad.postId.toObject(),
    isSponsored: true,
    ad: {
      id: ad._id,
      title: ad.title,
      description: ad.description,
      callToAction: ad.callToAction
    }
  }));
  
  res.json({ posts: sponsoredPosts });
});

// Track ad impression
app.post('/api/ads/:adId/impression', authMiddleware, async (req, res) => {
  const ad = await Ad.findById(req.params.adId);
  if (!ad) return res.status(404).json({ error: 'Ad not found' });
  
  ad.impressions = (ad.impressions || 0) + 1;
  await ad.save();
  
  res.json({ success: true });
});

// Track ad click
app.post('/api/ads/:adId/click', authMiddleware, async (req, res) => {
  const ad = await Ad.findById(req.params.adId);
  if (!ad) return res.status(404).json({ error: 'Ad not found' });
  
  ad.clicks = (ad.clicks || 0) + 1;
  await ad.save();
  
  res.json({ success: true });
});

// Pause/resume ad
app.put('/api/ads/:adId/status', authMiddleware, async (req, res) => {
  const { status } = req.body || {};
  
  const ad = await Ad.findOne({ _id: req.params.adId, userId: req.user.id });
  if (!ad) return res.status(404).json({ error: 'Ad not found' });
  
  if (!['active', 'paused'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  ad.status = status;
  await ad.save();
  
  res.json({ ad });
});

// Delete ad
app.delete('/api/ads/:adId', authMiddleware, async (req, res) => {
  const ad = await Ad.findOne({ _id: req.params.adId, userId: req.user.id });
  if (!ad) return res.status(404).json({ error: 'Ad not found' });
  
  await Ad.deleteOne({ _id: req.params.adId });
  
  res.json({ success: true });
});

const onlineByUserId = new Map();
const typingUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Missing token'));

  try {
    const user = jwt.verify(token, JWT_SECRET);
    socket.user = user;
    next();
  } catch (_err) {
    next(new Error('Invalid token'));
  }
});

const emitOnlineUsers = () => {
  io.emit('online_users', Array.from(onlineByUserId.keys()));
};

const emitTyping = (userId, peerId, isTyping) => {
  const peerSocketId = onlineByUserId.get(peerId);
  if (peerSocketId) {
    const user = socket?.users?.get(userId);
    io.to(peerSocketId).emit('user_typing', { 
      userId, 
      username: user?.username || 'User',
      isTyping 
    });
  }
};

// Media upload endpoint
app.post('/api/media/upload', authMiddleware, upload.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'media file is required' });
  
  const isVideo = req.file.mimetype.startsWith('video/');
  const isAudio = req.file.mimetype.startsWith('audio/');
  const mediaType = isVideo ? 'video' : isAudio ? 'voice' : 'image';
  
  const fileInfo = {
    filename: req.file.filename,
    url: `/uploads/original/${req.file.filename}`,
    mediaType
  };
  
  res.json({ success: true, ...fileInfo });
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  onlineByUserId.set(userId, socket.id);
  emitOnlineUsers();

  // Mark all pending messages to this user as delivered on connect.
  Message.find({ toUserId: userId, deliveredAt: null })
    .then(async (pending) => {
      if (!pending.length) return;
      const deliveredAt = new Date();
      const ids = pending.map((m) => m._id);
      await Message.updateMany({ _id: { $in: ids } }, { $set: { deliveredAt } });
      const bySender = new Map();
      pending.forEach((m) => {
        const senderId = m.fromUserId.toString();
        if (!bySender.has(senderId)) bySender.set(senderId, []);
        bySender.get(senderId).push(m._id.toString());
      });
      bySender.forEach((messageIds, senderId) => {
        const senderSocketId = onlineByUserId.get(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('messages_delivered', { by: userId, messageIds, deliveredAt });
        }
      });
    })
    .catch((err) => console.error('Error marking messages delivered:', err));

  socket.on('typing_start', ({ toUserId }) => {
    emitTyping(userId, toUserId, true);
  });

  socket.on('typing_stop', ({ toUserId }) => {
    emitTyping(userId, toUserId, false);
  });

  socket.on('group:join', async ({ groupId }) => {
    if (!groupId) return;
    try {
      const exists = await Group.findOne({ _id: groupId, 'members.userId': userId }).select('_id');
      if (!exists) return;
      socket.join(`group:${groupId}`);
    } catch (_) {}
  });

  socket.on('mark_read', async ({ messageIds, fromUserId }) => {
    if (messageIds && messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $addToSet: { readBy: userId }, $set: { deliveredAt: new Date() } }
      );
      const peerSocketId = onlineByUserId.get(fromUserId);
      if (peerSocketId) {
        io.to(peerSocketId).emit('messages_read', { by: userId, messageIds });
      }
    }
  });

  socket.on('private_message', async (payload) => {
    const { toUserId, text, replyTo, clientTempId } = payload || {};
    const cleanedText = typeof text === 'string' ? String(text).trim() : '';
    if (!toUserId || (!cleanedText && !replyTo)) return;

    const peerSocketId = onlineByUserId.get(toUserId);
    const deliveredAt = peerSocketId ? new Date() : null;

    const message = await Message.create({
      fromUserId: userId,
      toUserId,
      text: cleanedText.slice(0, 1000),
      replyTo: replyTo || null,
      deliveredAt
    });

    const fromUser = await User.findById(userId).select('username');
    const normalized = formatMessage(message, fromUser?.username);
    normalized.clientTempId = clientTempId || null;

    socket.emit('message', normalized);
    if (peerSocketId) io.to(peerSocketId).emit('message', normalized);
  });

  socket.on('media_message', async (payload) => {
    const { toUserId, mediaType, mediaUrl, duration, replyTo, clientTempId } = payload || {};
    if (!toUserId || !mediaType || !mediaUrl) return;

    const peerSocketId = onlineByUserId.get(toUserId);
    const deliveredAt = peerSocketId ? new Date() : null;

    const message = await Message.create({
      fromUserId: userId,
      toUserId,
      text: '',
      mediaType,
      mediaUrl,
      duration,
      replyTo: replyTo || null,
      deliveredAt
    });

    const fromUser = await User.findById(userId).select('username');
    const normalized = formatMessage(message, fromUser?.username);
    normalized.clientTempId = clientTempId || null;

    socket.emit('message', normalized);
    if (peerSocketId) io.to(peerSocketId).emit('message', normalized);
  });

  socket.on('call_offer', ({ toUserId, offer, callType }) => {
    const peerSocketId = onlineByUserId.get(toUserId);
    if (!peerSocketId) return;

    io.to(peerSocketId).emit('call_offer', {
      fromUserId: userId,
      fromUsername: socket.user.username,
      offer,
      callType
    });
  });

  socket.on('call_answer', ({ toUserId, answer }) => {
    const peerSocketId = onlineByUserId.get(toUserId);
    if (!peerSocketId) return;
    io.to(peerSocketId).emit('call_answer', {
      fromUserId: userId,
      answer
    });
  });

  socket.on('ice_candidate', ({ toUserId, candidate }) => {
    const peerSocketId = onlineByUserId.get(toUserId);
    if (!peerSocketId) return;
    io.to(peerSocketId).emit('ice_candidate', {
      fromUserId: userId,
      candidate
    });
  });

  socket.on('call_end', ({ toUserId }) => {
    const peerSocketId = onlineByUserId.get(toUserId);
    if (peerSocketId) io.to(peerSocketId).emit('call_end', { fromUserId: userId });
  });

  socket.on('disconnect', () => {
    if (onlineByUserId.get(userId) === socket.id) {
      onlineByUserId.delete(userId);
      emitOnlineUsers();
    }
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), queueEnabled: Boolean(reelQueue) });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, _next) => {
  if (isAbortLikeError(err) || req?.wasAborted) {
    return;
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  console.error('Unhandled request error:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

server.on('clientError', (err, socket) => {
  if (isAbortLikeError(err)) {
    socket.destroy();
    return;
  }
  console.error('Server client error:', err.message);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// MongoDB connection options
const mongoOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Connect to MongoDB and start server
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/social_app', mongoOptions);
    console.log('Connected to MongoDB');
    
    // Initialize GridFS for file storage
    mongoStorage.initializeGridFS(mongoose.connection.db);
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    await initQueueIfAvailable();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on ${usingHttps ? 'https' : 'http'}://localhost:${PORT} (bound to 0.0.0.0)`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

async function shutdown() {
  await mongoose.connection.close();
  if (reelQueue) await reelQueue.close();
  if (redisConnection) await redisConnection.quit();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();
