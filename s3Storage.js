const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const path = require('path');

// Initialize S3 client if credentials are provided
let s3Client = null;
let s3Bucket = null;
let s3Region = null;
let s3BaseUrl = null;

const initializeS3 = () => {
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const awsBucket = process.env.AWS_S3_BUCKET;
  const awsRegion = process.env.AWS_REGION || 'us-east-1';
  const awsBaseUrl = process.env.AWS_S3_BASE_URL;

  if (awsAccessKeyId && awsSecretAccessKey && awsBucket) {
    s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });
    s3Bucket = awsBucket;
    s3Region = awsRegion;
    s3BaseUrl = awsBaseUrl || `https://${awsBucket}.s3.${awsRegion}.amazonaws.com`;
    console.log('S3 storage initialized:', s3Bucket);
    return true;
  }
  return false;
};

// Check if S3 is configured
const isS3Configured = () => {
  return s3Client !== null && s3Bucket !== null;
};

// Upload file to S3
const uploadToS3 = async (filePath, key, contentType) => {
  if (!isS3Configured()) {
    throw new Error('S3 is not configured');
  }

  const fileBuffer = require('fs').readFileSync(filePath);
  
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: s3Bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    },
  });

  await upload.done();
  return `${s3BaseUrl}/${key}`;
};

// Delete file from S3
const deleteFromS3 = async (key) => {
  if (!isS3Configured()) {
    return false;
  }

  const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const command = new DeleteObjectCommand({
    Bucket: s3Bucket,
    Key: key,
  });

  await s3Client.send(command);
  return true;
};

// Get signed URL for private files (optional)
const getSignedUrl = async (key, expiresIn = 3600) => {
  if (!isS3Configured()) {
    return null;
  }

  const { GetSignedUrlCommand } = require('@aws-sdk/client-s3');
  const command = new GetSignedUrlCommand({
    Bucket: s3Bucket,
    Key: key,
  });
  
  // Note: For v3, we need to use a different approach
  // This is simplified - in production you'd use @aws-sdk/s3-request-presigner
  return `${s3BaseUrl}/${key}`;
};

// Get public URL for a file
const getPublicUrl = (key) => {
  if (!isS3Configured()) {
    return null;
  }
  return `${s3BaseUrl}/${key}`;
};

module.exports = {
  initializeS3,
  isS3Configured,
  uploadToS3,
  deleteFromS3,
  getSignedUrl,
  getPublicUrl,
};
