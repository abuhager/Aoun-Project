const express = require('express');
const router = express.Router();
// You are extracting the functions here:
const { register, login, verifyEmail } = require('../controllers/authController');

// مسار التسجيل
router.post('/register', register);

// FIX: Remove "authController." and use the extracted function name directly
router.post('/verify-email', verifyEmail); 

// مسار تسجيل الدخول
router.post('/login', login);

module.exports = router;