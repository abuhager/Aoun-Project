// middlewares/auth.js
// ============================================================
// ✅ PHASE 1 — REFACTORED
// الآن يقرأ Access Token من:
//   1. Header: x-auth-token  (للـ Postman والـ Legacy clients)
//   2. Cookie: accessToken   (httpOnly cookie — الأكثر أماناً)
// ============================================================
const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const headerToken = req.header('x-auth-token');
  const cookieToken = req.cookies?.accessToken ?? null;

  const token = headerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ msg: 'لا يوجد توكن، الوصول مرفوض' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // { id, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        msg: 'انتهت صلاحية الجلسة',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({ msg: 'توكن غير صالح' });
  }
};
