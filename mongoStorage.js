const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

// Initialize GridFS bucket
let bucket = null;

const initializeGridFS = (db) => {
  bucket = new GridFSBucket(db, {
    bucketName: 'uploads'
  });
  console.log('GridFS storage initialized');
  return bucket;
};

// Get the bucket
const getBucket = () => bucket;

// Upload file to GridFS
const uploadToGridFS = (filePath, filename, contentType) => {
  return new Promise((resolve, reject) => {
    if (!bucket) {
      return reject(new Error('GridFS not initialized'));
    }

    const fs = require('fs');
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        contentType,
        uploadedAt: new Date()
      }
    });

    const readStream = fs.createReadStream(filePath);
    
    readStream.on('error', (err) => {
      reject(err);
    });

    uploadStream.on('error', (err) => {
      reject(err);
    });

    uploadStream.on('finish', () => {
      resolve({
        id: uploadStream.id,
        filename: uploadStream.filename,
        url: `/api/files/${uploadStream.id}`
      });
    });

    readStream.pipe(uploadStream);
  });
};

// Upload buffer to GridFS
const uploadBufferToGridFS = (buffer, filename, contentType) => {
  return new Promise((resolve, reject) => {
    if (!bucket) {
      return reject(new Error('GridFS not initialized'));
    }

    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        contentType,
        uploadedAt: new Date()
      }
    });

    uploadStream.on('error', (err) => {
      reject(err);
    });

    uploadStream.on('finish', () => {
      resolve({
        id: uploadStream.id,
        filename: uploadStream.filename,
        url: `/api/files/${uploadStream.id}`
      });
    });

    uploadStream.end(buffer);
  });
};

// Get file from GridFS
const getFileFromGridFS = (fileId) => {
  return new Promise((resolve, reject) => {
    if (!bucket) {
      return reject(new Error('GridFS not initialized'));
    }

    const ObjectId = mongoose.Types.ObjectId;
    let fileId;
    
    try {
      fileId = new ObjectId(fileId);
    } catch (err) {
      return reject(new Error('Invalid file ID'));
    }

    const downloadStream = bucket.openDownloadStream(fileId);
    const chunks = [];

    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on('error', (err) => {
      reject(err);
    });

    downloadStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
};

// Delete file from GridFS
const deleteFromGridFS = (fileId) => {
  return new Promise((resolve, reject) => {
    if (!bucket) {
      return reject(new Error('GridFS not initialized'));
    }

    const ObjectId = mongoose.Types.ObjectId;
    let fileId;
    
    try {
      fileId = new ObjectId(fileId);
    } catch (err) {
      return reject(new Error('Invalid file ID'));
    }

    bucket.delete(fileId, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
};

// Check if GridFS is initialized
const isGridFSReady = () => {
  return bucket !== null;
};

module.exports = {
  initializeGridFS,
  getBucket,
  uploadToGridFS,
  uploadBufferToGridFS,
  getFileFromGridFS,
  deleteFromGridFS,
  isGridFSReady
};
