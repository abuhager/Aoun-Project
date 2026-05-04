const express        = require('express');
const router         = express.Router();
const auth           = require('../middlewares/auth');
const authController = require('../controllers/authController'); // ✅ ناقص هذا
const { globalLimiter, authLimiter } = require('../middlewares/rateLimiter');

// 1. التسجيل
router.post('/register', authLimiter, authController.register);

// 2. تأكيد الإيميل
router.post('/verify-email', authLimiter, authController.verifyEmail);

// 3. تسجيل الدخول
router.post('/login', authLimiter, authController.login);

// 4. نسيت كلمة المرور
router.post('/forgot-password', authLimiter, authController.forgotPassword);

// 5. إعادة تعيين كلمة المرور
router.post('/reset-password', authLimiter, authController.resetPassword);

// 6. بروفايل المستخدم
router.get('/me', auth, authController.getUserProfile);

module.exports = router;