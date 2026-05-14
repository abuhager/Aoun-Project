// middlewares/auth.js
const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokenUtils');

// ───────────────────────────────────────
// requireAuth — حماية كل route محمية
// ───────────────────────────────────────
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

  if (!token) {
    return res.status(401).json({ msg: 'لا يوجد توكن، الدخول مرفوض 🛑', code: 'NO_ACCESS_TOKEN' });
  }

  try {
    // ✅ verifyAccessToken من tokenUtils — مش jwt.verify مباشرة
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.user.id).select('isBanned role trustLevel');

    if (!user) return res.status(401).json({ msg: 'المستخدم غير موجود 🛑', code: 'USER_NOT_FOUND' });
    if (user.isBanned) return res.status(403).json({ msg: 'حسابك محظور 🚫', code: 'ACCOUNT_BANNED' });

    req.user = { id: decoded.user.id, role: user.role, trustLevel: user.trustLevel ?? 1 };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'انتهت صلاحية الجلسة ⏰', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ msg: 'التوكن غير صالح ⚠️', code: 'TOKEN_INVALID' });
  }
};

// ───────────────────────────────────────
// optionalAuth — للمسارات العامة مع تحسين
// ───────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.user.id).select('isBanned role trustLevel');
    if (user && !user.isBanned) {
      req.user = { id: decoded.user.id, role: user.role, trustLevel: user.trustLevel ?? 1 };
    }
  } catch (err) {
    // ✅ تسجيل السبب للـ debugging بدل ابتلاع الخطأ صامتاً
    console.warn('[optionalAuth] token rejected:', err.message);
  }
  next();
};

// ───────────────────────────────────────
// requireAdmin — للمسارات الإدارية فقط
// ───────────────────────────────────────
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ msg: 'يجب تسجيل الدخول أولاً', code: 'NO_AUTH' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ msg: 'صلاحيات المدير مطلوبة 🔒', code: 'ADMIN_REQUIRED' });
  }
  next();
};

// ───────────────────────────────────────
// requireLevel2 — للحجز فقط (Phase 2)
// Level 2 = طالب جامعي OR رقم واتساب مُحقَّق OR مُرقَّى يدوياً
// ───────────────────────────────────────
const requireLevel2 = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ msg: 'يجب تسجيل الدخول أولاً', code: 'NO_AUTH' });
  }
  if ((req.user.trustLevel ?? 1) < 2) {
    return res.status(403).json({
      msg: 'يجب التحقق من هويتك أولاً للحجز (إيميل جامعي أو واتساب) 🔐',
      code: 'LEVEL2_REQUIRED',
    });
  }
  next();
};

module.exports = requireAuth;
module.exports.optionalAuth = optionalAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.requireLevel2 = requireLevel2;