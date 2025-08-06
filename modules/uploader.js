// modules/uploader.js
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

const CLOUD_NAME = 'dnffszhwj';
const API_KEY = '412627323443648';
const API_SECRET = 'iYXGac4by5chmeiiS6w6jnGlrtQ'; // 🔁 Replace with correct secret

async function uploadToCloudinary(filePath) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `timestamp=${timestamp}${API_SECRET}`;
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('api_key', API_KEY);
  form.append('timestamp', timestamp);
  form.append('signature', signature);

  try {
    const response = await axios.post(url, form, {
      headers: form.getHeaders()
    });
    return response.data.secure_url;
  } catch (error) {
    console.error('❌ Cloudinary upload failed:', error.response?.data || error);
    throw error;
  }
}

module.exports = { uploadToCloudinary };
