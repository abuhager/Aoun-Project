// utils/otp.js
const crypto = require('crypto');

// توليد OTP مكوّن من 6 أرقام
function generateOtp() {
  // يرجّع رقم بين 100000 و 999999 (6 أرقام)
  return crypto.randomInt(100000, 1000000).toString();
}

module.exports = { generateOtp };