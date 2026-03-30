const express = require('express');
const router = express.Router();
// You are extracting the functions here:
const { register, login, verifyEmail,getUserProfile,forgotPassword, resetPassword} = require('../controllers/authController');

router.get('/profile/:id', getUserProfile); // ضفنا كلمة profile هون// مسار التسجيل
router.post('/register', register);

// FIX: Remove "authController." and use the extracted function name directly
router.post('/verify-email', verifyEmail); 

// مسار تسجيل الدخول
router.post('/login', login);

router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

module.exports = router;