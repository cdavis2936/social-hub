const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Configure Cloudinary
const initializeCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('Cloudinary credentials not configured');
    return false;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });

  console.log('Cloudinary initialized:', cloudName);
  return true;
};

const isCloudinaryReady = () => {
  return !!process.env.CLOUDINARY_CLOUD_NAME;
};

/**
 * Upload to Cloudinary Storage.
 * Supports both memory buffer and disk file paths.
 */
const uploadToCloudinary = async (fileOrPath, folder = 'uploads') => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error('Cloudinary not configured');
  }

  // If it's a string (file path)
  if (typeof fileOrPath === 'string') {
    const localPath = fileOrPath;
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local file does not exist: ${localPath}`);
    }

    const result = await cloudinary.uploader.upload(localPath, {
      folder,
      resource_type: 'auto'
    });

    return {
      url: result.secure_url,
      filename: result.public_id
    };
  }

  // If it's an object (multer file)
  if (typeof fileOrPath === 'object' && fileOrPath !== null) {
    const file = fileOrPath;

    // Memory storage (buffer)
    if (file.buffer) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve({
                url: result.secure_url,
                filename: result.public_id
              });
            }
          }
        );

        // Create a buffer stream from the memory buffer
        const Buffer = require('buffer').Buffer;
        uploadStream.end(file.buffer);
      });
    }

    // Disk storage (path)
    if (file.path) {
      if (!fs.existsSync(file.path)) {
        throw new Error(`Multer disk file not found at path: ${file.path}`);
      }

      const result = await cloudinary.uploader.upload(file.path, {
        folder,
        resource_type: 'auto'
      });

      return {
        url: result.secure_url,
        filename: result.public_id
      };
    }

    throw new Error('Unsupported multer file object: missing buffer and path');
  }

  throw new Error('Invalid arguments provided to uploadToCloudinary');
};

module.exports = {
  initializeCloudinary,
  isCloudinaryReady,
  uploadToCloudinary
};
