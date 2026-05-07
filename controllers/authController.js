const authService = require('../services/authService');
const {
  validateRegister,
  validateVerifyEmail,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require('../dtos/authDto');
const mongoose = require('mongoose');
const {
  REFRESH_COOKIE_OPTIONS,
  CLEAR_REFRESH_COOKIE_OPTIONS,
} = require('../utils/tokenUtils');

exports.register = async (req, res) => {
  const { error } = validateRegister(req.body);
  if (error) return res.status(400).json({ msg: error.details[0].message });

  try {
    const result = await authService.registerLogic(req.body);
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { error } = validateVerifyEmail(req.body);
  if (error) return res.status(400).json({ msg: error.details[0].message });

  try {
    const result = await authService.verifyEmailLogic(req.body);
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ msg: 'خطأ في السيرفر أثناء تفعيل الحساب' });
  }
};

exports.login = async (req, res) => {
  const { error } = validateLogin(req.body);
  if (error) return res.status(400).json({ msg: error.details[0].message });

  try {
    const result = await authService.loginLogic(req.body);

    // ✅ ازرع الكوكي لو اللوجين نجح
    if (result.statusCode === 200 && result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    }

    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const result = await authService.getUserProfileLogic(req.user.id);
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
};

exports.getPublicProfile = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ msg: 'معرف المستخدم غير صحيح' });
  }

  try {
    const result = await authService.getPublicProfileLogic(req.params.id);
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
};

exports.forgotPassword = async (req, res) => {
  const { error } = validateForgotPassword(req.body);
  if (error) return res.status(400).json({ msg: error.details[0].message });

  try {
    const result = await authService.forgotPasswordLogic(req.body.email);
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    return res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
};

exports.resetPassword = async (req, res) => {
  const { error } = validateResetPassword(req.body);
  if (error) return res.status(400).json({ msg: error.details[0].message });

  try {
    const result = await authService.resetPasswordLogic(
      req.body.token,
      req.body.password
    );
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    return res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
};

exports.refreshToken = async (req, res) => {
  console.log('🍪 headers.cookie:', req.headers.cookie);
  console.log('🍪 req.cookies:', req.cookies);
  try {
    const result = await authService.refreshTokenLogic(req.cookies?.refreshToken);

    if (result.clearCookie) {
      res.clearCookie('refreshToken', CLEAR_REFRESH_COOKIE_OPTIONS);
    }

    if (result.statusCode === 200 && result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    }

    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err.message);
    res.clearCookie('refreshToken', CLEAR_REFRESH_COOKIE_OPTIONS);
    return res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
};

exports.logout = async (req, res) => {
  try {
    const result = await authService.logoutLogic(req.user.id);
    res.clearCookie('refreshToken', CLEAR_REFRESH_COOKIE_OPTIONS);
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err.message);
    res.clearCookie('refreshToken', CLEAR_REFRESH_COOKIE_OPTIONS);
    return res.status(500).json({ msg: 'خطأ في السيرفر' });
  }
};