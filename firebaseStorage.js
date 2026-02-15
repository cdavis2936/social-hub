const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const path = require('path');
const fs = require('fs');

// Firebase storage bucket name
const BUCKET_NAME = 'social-hub-48bb8.appspot.com';

let bucket = null;

// Initialize Firebase with service account
const initializeFirebase = () => {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    if (!projectId || !clientEmail || !privateKey) {
      console.warn('Firebase credentials not configured');
      return false;
    }
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.split('\\n').join('\n'),
      }),
      storageBucket: BUCKET_NAME,
    });

    // Be explicit about the bucket we use
    bucket = getStorage().bucket(BUCKET_NAME);
    console.log('Firebase Storage initialized:', BUCKET_NAME);
    return true;
  } catch (err) {
    console.error('Firebase initialization failed:', err.message);
    return false;
  }
};

// Check if Firebase is initialized
const isFirebaseReady = () => {
  return bucket !== null;
};

// Helper to create a safe destination path when not provided
function makeDestPath(baseName) {
  const safeBase = baseName ? path.basename(baseName).replace(/\s+/g, '_') : 'file';
  return `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeBase}`;
}

/**
 * Upload to Firebase Storage.
 *
 * Supported signatures:
 *  - uploadToFirebase(multerMemoryFile)
 *  - uploadToFirebase(multerDiskFile)
 *  - uploadToFirebase(filePathString, destinationPath, contentType)
 *
 * Returns: { url, filename }
 */
const uploadToFirebase = async (fileOrPath, destinationPath, contentType) => {
  if (!bucket) {
    throw new Error('Firebase not initialized');
  }

  // If the first arg is a string, treat it as a local file path
  if (typeof fileOrPath === 'string') {
    const localPath = fileOrPath;
    const destPath = destinationPath || makeDestPath(localPath);
    const mimeType = contentType || 'application/octet-stream';

    // ensure file exists
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local file does not exist: ${localPath}`);
    }

    await bucket.upload(localPath, {
      destination: destPath,
      metadata: {
        contentType: mimeType,
        metadata: {
          uploadedAt: new Date().toISOString()
        }
      }
    });

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURI(destPath)}`;
    return { url: publicUrl, filename: destPath };
  }

  // If it's an object (multer file)
  if (typeof fileOrPath === 'object' && fileOrPath !== null) {
    const file = fileOrPath;

    // Determine destination and mimetype
    const originalName = file.originalname || '';
    const destPath = destinationPath || makeDestPath(originalName || file.filename || 'file');
    const mimeType = contentType || file.mimetype || 'application/octet-stream';

    // Memory storage (buffer)
    if (file.buffer) {
      const fileObj = bucket.file(destPath);

      await fileObj.save(file.buffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            uploadedAt: new Date().toISOString()
          }
        },
        resumable: false
      });

      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURI(destPath)}`;
      return { url: publicUrl, filename: destPath };
    }

    // Disk storage (path)
    if (file.path) {
      // ensure file exists
      if (!fs.existsSync(file.path)) {
        throw new Error(`Multer disk file not found at path: ${file.path}`);
      }

      await bucket.upload(file.path, {
        destination: destPath,
        metadata: {
          contentType: mimeType,
          metadata: {
            uploadedAt: new Date().toISOString()
          }
        }
      });

      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURI(destPath)}`;
      return { url: publicUrl, filename: destPath };
    }

    throw new Error('Unsupported multer file object: missing buffer and path');
  }

  throw new Error('Invalid arguments provided to uploadToFirebase');
};

// Delete file from Firebase Storage
const deleteFromFirebase = async (destinationPath) => {
  if (!bucket) {
    throw new Error('Firebase not initialized');
  }

  if (!destinationPath) {
    throw new Error('destinationPath is required to delete from Firebase');
  }

  const file = bucket.file(destinationPath);
  await file.delete();
  return true;
};

// Get public URL for a file
const getPublicUrl = (destinationPath) => {
  if (!destinationPath) return '';
  return `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURI(destinationPath)}`;
};

module.exports = {
  initializeFirebase,
  isFirebaseReady,
  uploadToFirebase,
  deleteFromFirebase,
  getPublicUrl
};