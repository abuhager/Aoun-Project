// controllers/authController.js
// ============================================================
// ✅ PHASE 1 — REFACTORED
// التغييرات:
//   + httpOnly Cookies لكلا الـ Tokens
//   + refreshToken endpoint
//   + logout endpoint
//   ~ getUserProfile FIX: req.user.id بدل req.params.id
// ============================================================
const authService = require('../services/authService');

function setRefreshTokenCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   7 * 24 * 60 * 60 * 1000,
    path:     '/api/auth',
  });
}

function setAccessTokenCookie(res, accessToken) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   15 * 60 * 1000,
    path:     '/',
  });
}

exports.register = async (req, res) => {
  try {
    const result = await authService.registerLogic(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.msg || 'خطأ في الخادم' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const result = await authService.verifyEmailLogic(req.body);
    setRefreshTokenCookie(res, result.refreshToken);
    setAccessTokenCookie(res, result.accessToken);
    res.status(200).json({ msg: 'تم التحقق بنجاح', token: result.accessToken, user: result.user });
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.msg || 'خطأ في الخادم' });
  }
};

exports.login = async (req, res) => {
  try {
    const result = await authService.loginLogic(req.body);
    setRefreshTokenCookie(res, result.refreshToken);
    setAccessTokenCookie(res, result.accessToken);
    res.status(200).json({ token: result.accessToken, user: result.user });
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.msg || 'خطأ في الخادم', needsVerification: err.needsVerification || false });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const incomingRefreshToken = req.cookies?.refreshToken;
    const result = await authService.refreshAccessTokenLogic(incomingRefreshToken);
    setRefreshTokenCookie(res, result.refreshToken);
    setAccessTokenCookie(res, result.accessToken);
    res.status(200).json({ token: result.accessToken });
  } catch (err) {
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.clearCookie('accessToken',  { path: '/' });
    res.status(err.status || 401).json({ msg: err.msg || 'جلسة غير صالحة' });
  }
};

exports.logout = async (req, res) => {
  try {
    await authService.logoutLogic(req.user.id);
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.clearCookie('accessToken',  { path: '/' });
    res.status(200).json({ msg: 'تم تسجيل الخروج بنجاح' });
  } catch (err) {
    res.status(500).json({ msg: 'خطأ في تسجيل الخروج' });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    // ✅ FIX: كان req.params.id — الآن req.user.id
    const user = await authService.getUserProfileLogic(req.user.id);
    res.status(200).json(user);
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.msg || 'خطأ في الخادم' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const result = await authService.forgotPasswordLogic(req.body.email);
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.msg || 'خطأ في الخادم' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    const result = await authService.resetPasswordLogic(email, otp, password);
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.msg || 'خطأ في الخادم' });
  }
};
