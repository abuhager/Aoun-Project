const jwt = require('jsonwebtoken');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

  if (!token) {
    return res.status(401).json({
      msg: 'لا يوجد توكن، الدخول مرفوض 🛑',
      code: 'NO_ACCESS_TOKEN',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.user.id).select('isBanned role');
    if (!user) {
      return res.status(401).json({
        msg: 'المستخدم غير موجود 🛑',
        code: 'USER_NOT_FOUND',
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        msg: 'حسابك محظور 🚫',
        code: 'ACCOUNT_BANNED',
      });
    }

    req.user = {
      id: decoded.user.id,
      role: user.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        msg: 'انتهت صلاحية الجلسة ⏰',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      msg: 'التوكن غير صالح ⚠️',
      code: 'TOKEN_INVALID',
    });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id).select('isBanned role');

    if (user && !user.isBanned) {
      req.user = {
        id: decoded.user.id,
        role: user.role,
      };
    }
  } catch (_) {}

  next();
};

module.exports = requireAuth;
module.exports.optionalAuth = optionalAuth;