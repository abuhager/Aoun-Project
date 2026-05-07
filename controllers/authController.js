const authService = require('../services/authService');
const {
  validateRegister,
  validateVerifyEmail,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
} = require('../dtos/authDto');

// ─── 1. التسجيل ───────────────────────────────────────
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

// ─── 2. تأكيد الإيميل ────────────────────────────────
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

// ─── 3. تسجيل الدخول ─────────────────────────────────
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

// ─── 4. بروفايل المستخدم ─────────────────────────────
// ✅ الإصلاح: استخدام req.user.id (من الـ auth middleware) بدلاً من req.params.id
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;          // ← الإصلاح هنا
    const result = await authService.getUserProfileLogic(userId);
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'المستخدم غير موجود' });
    res.status(500).send('خطأ في السيرفر');
  }
};

// ─── 5. نسيت كلمة المرور ─────────────────────────────
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

// ─── 6. إعادة تعيين كلمة المرور ──────────────────────
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
