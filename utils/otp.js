// utils/otp.js
const crypto = require('crypto');

/**
 * ✅ Cryptographically secure OTP — بدل Math.random() الخطير
 */
const generateOtp = () => {
  // رقم عشوائي آمن بين 100000 و 999999
  return String(crypto.randomInt(100000, 1000000));
};

module.exports = { generateOtp };