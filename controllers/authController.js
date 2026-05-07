const authService = require('../services/authService');
const {
  validateRegister,
  validateVerifyEmail,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
} = require('../dtos/authDto');
const mongoose = require('mongoose');

// ─── 1. التسجيل ────────────────────────────────────────
exports.register = async (req, res) => {
  const { error } = validateRegister(req.body);
  if (error) return res.status(400).json({ msg: error.details[0].message });
  try {
    const result = await authService.registerLogic(req.body);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في السيرفر');
  }
};

// ─── 2. تأكيد الإيميل ─────────────────────────────────
exports.verifyEmail = async (req, res) => {
  const { error } = validateVerifyEmail(req.body);
  if (error) return res.status(400).json({ msg: error.details[0].message });
  try {
    const result = await authService.verifyEmailLogic(req.body);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في السيرفر أثناء تفعيل الحساب');
  }
};

// ─── 3. تسجيل الدخول ──────────────────────────────────
exports.login = async (req, res) => {
  const { error } = validateLogin(req.body);
  if (error) return res.status(400).json({ msg: error.details[0].message });
  try {
    const result = await authService.loginLogic(req.body);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('خطأ في السيرفر');
  }
};

// ─── 4. بروفايل المستخدم الخاص (GET /me) ───────────────
exports.getUserProfile = async (req, res) => {
  try {
    const result = await authService.getUserProfileLogic(req.user.id);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).send('خطأ في السيرفر');
  }
};

// ─── 5. بروفايل عام (GET /profile/:id) ─────────────────────
exports.getPublicProfile = async (req, res) => {
  // ✅ validate ObjectId قبل الاستعلام
  if (!mongoose.Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ msg: 'معرف المستخدم غير صحيح' });
  try {
    const result = await authService.getPublicProfileLogic(req.params.id);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
};

// ─── 6. نسيت كلمة المرور ────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const { error } = validateForgotPassword(req.body);
  if (error) return res.status(400).json({ msg: error.details[0].message });
  try {
    const result = await authService.forgotPasswordLogic(req.body.email);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
};

// ─── 7. إعادة تعيين كلمة المرور ──────────────────────────
exports.resetPassword = async (req, res) => {
  const { error } = validateResetPassword(req.body);
  if (error) return res.status(400).json({ msg: error.details[0].message });
  try {
    const result = await authService.resetPasswordLogic(req.params.token, req.body.password);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
};
