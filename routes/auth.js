// routes/auth.js
// ============================================================
// ✅ PHASE 1 — UPDATED
// + POST /refresh-token — تجديد Access Token
// + POST /logout        — تسجيل خروج آمن
// ============================================================
const express        = require('express');
const router         = express.Router();
const auth           = require('../middlewares/auth');
const authController = require('../controllers/authController');

router.post('/register',        authController.register);
router.post('/verify-email',    authController.verifyEmail);
router.post('/login',           authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password',  authController.resetPassword);
router.post('/refresh-token',   authController.refreshToken);

router.get('/me',               auth, authController.getUserProfile);
router.post('/logout',          auth, authController.logout);

module.exports = router;
