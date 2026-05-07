const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const authController = require('../controllers/authController');
const { globalLimiter, authLimiter } = require('../middlewares/rateLimiter');

// التسجيل
router.post('/register', authLimiter, authController.register);

// تأكيد الإيميل
router.post('/verify-email', authLimiter, authController.verifyEmail);

// تسجيل الدخول
router.post('/login', authLimiter, authController.login);

// نسيت كلمة المرور
router.post('/forgot-password', authLimiter, authController.forgotPassword);

// إعادة تعيين كلمة المرور
router.post('/reset-password', authLimiter, authController.resetPassword);

// بروفايل خاص
router.get('/me', auth, authController.getUserProfile);

// بروفايل عام
router.get('/profile/:id', globalLimiter, authController.getPublicProfile);

// refresh
router.post('/refresh', authLimiter, authController.refreshToken);

// logout
router.post('/logout', auth, authController.logout);

module.exports = router;