const express = require('express');
const router = express.Router();

// 🛡️ استدعاء حارس تسجيل الدخول اللي عملناه
const { authLimiter } = require('../middlewares/rateLimiter'); 
const { register, login, verifyEmail, getUserProfile, forgotPassword, resetPassword } = require('../controllers/authController');

router.get('/profile/:id', getUserProfile); 
router.post('/register', register);
router.post('/verify-email', verifyEmail); 

// 🛡️ تطبيق الحماية الصارمة (authLimiter) على تسجيل الدخول
router.post('/login', authLimiter, login);

// 🛡️ تطبيق نفس الحماية على نسيان كلمة المرور (عشان نمنع السبام والإزعاج بالإيميلات)
router.post('/forgot-password', authLimiter, forgotPassword);
router.put('/reset-password/:token', resetPassword);

module.exports = router;