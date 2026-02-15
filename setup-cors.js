const { Storage } = require('@google-cloud/storage');
const fs = require('fs');

async function configureCors() {
  const corsConfig = JSON.parse(fs.readFileSync('firebase-cors.json', 'utf8'));
  
  const storage = new Storage();
  const bucket = storage.bucket('social-hub-48bb8.appspot.com');
  
  await bucket.setMetadata({
    cors: corsConfig
  });
  
  console.log('CORS configured successfully for gs://social-hub-48bb8.appspot.com');
}

configureCors().catch(console.error);
