const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');

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
      storageBucket: `${projectId}.appspot.com`,
    });

    bucket = getStorage().bucket();
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

// Upload multer file to Firebase Storage
// Can be called with either (file) for backward compatibility or (file, destinationPath, contentType)
const uploadToFirebase = async (fileOrPath, destinationPath, contentType) => {
  if (!bucket) {
    throw new Error('Firebase not initialized');
  }

  // Handle both old signature (file) and new signature (file, destinationPath, contentType)
  let file, destPath, mimeType;
  if (typeof fileOrPath === 'object' && fileOrPath.buffer) {
    // Old signature: uploadToFirebase(file)
    file = fileOrPath;
    destPath = destinationPath || `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname || 'file'}`;
    mimeType = contentType || file.mimetype || 'application/octet-stream';
  } else {
    // New signature: uploadToFirebase(filePath, destinationPath, contentType)
    // fileOrPath is actually the file object in this case from multer memoryStorage
    file = fileOrPath;
    destPath = destinationPath;
    mimeType = contentType;
  }

  const fileObj = bucket.file(destPath);
  
  await fileObj.save(file.buffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        uploadedAt: new Date().toISOString()
      }
    }
  });

  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destPath}`;
  return { url: publicUrl, filename: destPath };
};

// Delete file from Firebase Storage
const deleteFromFirebase = async (destinationPath) => {
  if (!bucket) {
    throw new Error('Firebase not initialized');
  }

  const file = bucket.file(destinationPath);
  await file.delete();
  return true;
};

// Get public URL for a file
const getPublicUrl = (destinationPath) => {
  return `https://storage.googleapis.com/${BUCKET_NAME}/${destinationPath}`;
};

module.exports = {
  initializeFirebase,
  isFirebaseReady,
  uploadToFirebase,
  deleteFromFirebase,
  getPublicUrl
};
