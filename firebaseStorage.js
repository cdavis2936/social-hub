const { initializeApp, cert } = require('firebase-admin/storage');
const { getStorage } = require('firebase-admin/storage');

// Firebase storage bucket name
const BUCKET_NAME = 'social-hub-48bb8.appspot.com';

let bucket = null;

// Initialize Firebase with service account
const initializeFirebase = () => {
  try {
    // Get Firebase config from separate environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    
    if (!projectId || !clientEmail || !privateKey) {
      console.warn('Firebase credentials not configured');
      console.warn('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
      return false;
    }
    
    const serviceAccount = {
      projectId,
      clientEmail,
      privateKey
    };
    
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: BUCKET_NAME
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

// Upload file to Firebase Storage
const uploadToFirebase = (filePath, destinationPath, contentType) => {
  return new Promise((resolve, reject) => {
    if (!bucket) {
      return reject(new Error('Firebase not initialized'));
    }

    const options = {
      destination: destinationPath,
      metadata: {
        contentType,
        metadata: {
          uploadedAt: new Date().toISOString()
        }
      }
    };

    bucket.upload(filePath, options, (err, file) => {
      if (err) {
        reject(err);
      } else {
        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destinationPath}`;
        resolve({
          id: file[0].id,
          filename: destinationPath,
          url: publicUrl
        });
      }
    });
  });
};

// Upload buffer to Firebase Storage
const uploadBufferToFirebase = (buffer, destinationPath, contentType) => {
  return new Promise((resolve, reject) => {
    if (!bucket) {
      return reject(new Error('Firebase not initialized'));
    }

    const file = bucket.file(destinationPath);
    
    const options = {
      metadata: {
        contentType,
        metadata: {
          uploadedAt: new Date().toISOString()
        }
      }
    };

    file.save(buffer, options, (err) => {
      if (err) {
        reject(err);
      } else {
        const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destinationPath}`;
        resolve({
          id: file.id,
          filename: destinationPath,
          url: publicUrl
        });
      }
    });
  });
};

// Delete file from Firebase Storage
const deleteFromFirebase = (destinationPath) => {
  return new Promise((resolve, reject) => {
    if (!bucket) {
      return reject(new Error('Firebase not initialized'));
    }

    const file = bucket.file(destinationPath);
    file.delete((err) => {
      if (err) {
        // Ignore if file doesn't exist
        if (err.code === 404) {
          resolve(true);
        } else {
          reject(err);
        }
      } else {
        resolve(true);
      }
    });
  });
};

// Get public URL for a file
const getPublicUrl = (destinationPath) => {
  return `https://storage.googleapis.com/${BUCKET_NAME}/${destinationPath}`;
};

module.exports = {
  initializeFirebase,
  isFirebaseReady,
  uploadToFirebase,
  uploadBufferToFirebase,
  deleteFromFirebase,
  getPublicUrl
};
