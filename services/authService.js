// services/authService.js
// ============================================================
// ✅ PHASE 1 — REFACTORED
// التغييرات:
//   + generateTokens()       — Access (15m) + Refresh (7d)
//   + refreshAccessToken()   — Refresh Token Rotation
//   + logoutLogic()          — حذف Refresh Token من DB
//   ~ OTP مشفّر بـ SHA-256 قبل الحفظ في DB
//   ~ verifyEmailLogic       — يرجع كلا الـ Tokens
//   ~ loginLogic             — يرجع كلا الـ Tokens
// ============================================================
const crypto    = require('crypto');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const User      = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { generateOtp } = require('../utils/otp');
const {
  validateRegister,
  validateLogin,
  validateVerifyEmail,
} = require('../dtos/authDto');

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateTokens(userId, role) {
  const payload = { user: { id: userId, role } };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

exports.registerLogic = async (body) => {
  const { error } = validateRegister(body);
  if (error) throw { status: 400, msg: error.details[0].message };

  const { name, email, password, phone } = body;

  const existingUser = await User.findOne({ email });
  if (existingUser) throw { status: 400, msg: 'البريد الإلكتروني مسجّل مسبقاً' };

  const salt       = await bcrypt.genSalt(12);
  const hashedPass = await bcrypt.hash(password, salt);
  const otp        = generateOtp();
  const hashedOtp  = hashOtp(otp);

  const isUniversityEmail =
    email.endsWith('.edu') || email.endsWith('.edu.jo') ||
    email.endsWith('.ac.uk') || email.endsWith('.edu.sa');

  const user = new User({
    name,
    email,
    password:          hashedPass,
    phone:             phone || null,
    verificationOtp:   hashedOtp,
    otpExpiry:         new Date(Date.now() + 10 * 60 * 1000),
    isVerifiedStudent: isUniversityEmail,
    trustLevel:        isUniversityEmail ? 2 : 1,
  });

  await user.save();

  await sendEmail({
    email,
    subject: '🔐 رمز التحقق — منصة عون',
    message: `<div dir="rtl" style="font-family:sans-serif;padding:20px"><h2>مرحباً ${name} 👋</h2><p>رمز التحقق الخاص بك:</p><h1 style="letter-spacing:8px;color:#16a34a">${otp}</h1><p style="color:#666">صالح لمدة 10 دقائق فقط</p></div>`,
  });

  return { msg: 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني.' };
};

exports.verifyEmailLogic = async (body) => {
  const { error } = validateVerifyEmail(body);
  if (error) throw { status: 400, msg: error.details[0].message };

  const { email, otp } = body;
  const hashedOtp = hashOtp(otp);

  const user = await User.findOne({ email }).select('+verificationOtp +otpExpiry +password');

  if (!user)           throw { status: 400, msg: 'المستخدم غير موجود' };
  if (user.isVerified) throw { status: 400, msg: 'الحساب مفعّل مسبقاً' };
  if (!user.verificationOtp || user.verificationOtp !== hashedOtp) {
    throw { status: 400, msg: 'رمز التحقق غير صحيح' };
  }
  if (user.otpExpiry && user.otpExpiry < new Date()) {
    throw { status: 400, msg: 'انتهت صلاحية رمز التحقق' };
  }

  const { accessToken, refreshToken } = generateTokens(user._id, user.role);

  user.isVerified      = true;
  user.verificationOtp = undefined;
  user.otpExpiry       = undefined;
  user.refreshToken    = refreshToken;
  await user.save();

  return {
    accessToken,
    refreshToken,
    user: {
      _id: user._id, name: user.name, email: user.email, role: user.role,
      trustScore: user.trustScore, trustLevel: user.trustLevel,
      quota: user.quota, isVerified: true,
      isVerifiedStudent: user.isVerifiedStudent, phoneVerified: user.phoneVerified,
      isBanned: user.isBanned, totalDonations: user.totalDonations, badges: user.badges,
    },
  };
};

exports.loginLogic = async (body) => {
  const { error } = validateLogin(body);
  if (error) throw { status: 400, msg: error.details[0].message };

  const { email, password } = body;

  const user = await User.findOne({ email }).select('+password +refreshToken');
  if (!user) throw { status: 400, msg: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };

  if (!user.isVerified) throw { status: 400, msg: 'يجب تفعيل الحساب أولاً', needsVerification: true };
  if (user.isBanned)    throw { status: 403, msg: 'حسابك موقوف. تواصل مع الدعم.' };

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw { status: 400, msg: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };

  const { accessToken, refreshToken } = generateTokens(user._id, user.role);
  user.refreshToken = refreshToken;
  await user.save();

  return {
    accessToken,
    refreshToken,
    user: {
      _id: user._id, name: user.name, email: user.email, role: user.role,
      trustScore: user.trustScore, trustLevel: user.trustLevel,
      quota: user.quota, isVerified: user.isVerified,
      isVerifiedStudent: user.isVerifiedStudent, phoneVerified: user.phoneVerified,
      isBanned: user.isBanned, totalDonations: user.totalDonations, badges: user.badges,
    },
  };
};

exports.refreshAccessTokenLogic = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) throw { status: 401, msg: 'لا يوجد Refresh Token' };

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw { status: 401, msg: 'Refresh Token غير صالح أو منتهي' };
  }

  const user = await User.findById(decoded.user.id).select('+refreshToken');
  if (!user || user.refreshToken !== incomingRefreshToken) {
    if (user) { user.refreshToken = undefined; await user.save(); }
    throw { status: 401, msg: 'جلسة غير صالحة. يرجى تسجيل الدخول مجدداً.' };
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id, user.role);
  user.refreshToken = newRefreshToken;
  await user.save();

  return { accessToken, refreshToken: newRefreshToken };
};

exports.logoutLogic = async (userId) => {
  await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
  return { msg: 'تم تسجيل الخروج بنجاح' };
};

exports.getUserProfileLogic = async (userId) => {
  const user = await User.findById(userId).select(
    '-password -verificationOtp -otpExpiry -refreshToken -resetPasswordToken -resetPasswordExpire'
  );
  if (!user) throw { status: 404, msg: 'المستخدم غير موجود' };
  return user;
};

exports.forgotPasswordLogic = async (email) => {
  const user = await User.findOne({ email });
  if (!user) return { msg: 'إذا كان الحساب موجوداً، ستصل رسالة للبريد الإلكتروني' };

  const otp       = generateOtp();
  const hashedOtp = hashOtp(otp);
  user.resetPasswordToken  = hashedOtp;
  user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  await sendEmail({
    email,
    subject: '🔑 استعادة كلمة المرور — منصة عون',
    message: `<div dir="rtl" style="font-family:sans-serif;padding:20px"><h2>استعادة كلمة المرور</h2><p>رمز إعادة التعيين:</p><h1 style="letter-spacing:8px;color:#dc2626">${otp}</h1><p style="color:#666">صالح لمدة 15 دقيقة فقط</p></div>`,
  });

  return { msg: 'إذا كان الحساب موجوداً، ستصل رسالة للبريد الإلكتروني' };
};

exports.resetPasswordLogic = async (email, otp, newPassword) => {
  const hashedOtp = hashOtp(otp);
  const user = await User.findOne({
    email,
    resetPasswordToken:  hashedOtp,
    resetPasswordExpire: { $gt: new Date() },
  }).select('+password');

  if (!user) throw { status: 400, msg: 'رمز إعادة التعيين غير صحيح أو منتهي' };

  const salt    = await bcrypt.genSalt(12);
  user.password = await bcrypt.hash(newPassword, salt);
  user.resetPasswordToken  = undefined;
  user.resetPasswordExpire = undefined;
  await User.findByIdAndUpdate(user._id, { $unset: { refreshToken: 1 } });
  await user.save();

  return { msg: 'تم تغيير كلمة المرور بنجاح' };
};

exports.generateTokens = generateTokens;
