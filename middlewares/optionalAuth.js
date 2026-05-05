// middlewares/optionalAuth.js
// ============================================================
// ✅ PHASE 1 — NEW FILE
// الغرض: يسمح للـ Guests والـ Logged-in Users بنفس الـ Route
// مثال: GET /api/items/:id
// ============================================================
const jwt = require('jsonwebtoken');

module.exports = function optionalAuth(req, res, next) {
  const headerToken = req.header('x-auth-token');
  const cookieToken = req.cookies?.accessToken ?? null;
  const token = headerToken || cookieToken;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
  } catch {
    req.user = null;
  }
  next();
};
