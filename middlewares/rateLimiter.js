const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

// 🛡️ 1. Rate Limiter العام
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 150,
  message: { msg: '🛑 طلبات كثيرة جداً من جهازك، الرجاء الانتظار قليلاً.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});

// 🛡️ 2. Rate Limiter لمسارات auth الحساسة
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 1000 : 10,
  message: { msg: '🛑 محاولات تسجيل دخول كثيرة، حسابك مقفل مؤقتاً لمدة ساعة.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => isDev,
});

// 🛡️ 3. Refresh limiter أخف لأن refresh طبيعي يتكرر
const refreshLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isDev ? 2000 : 60,
  message: { msg: '🛑 طلبات تجديد الجلسة كثيرة جداً، حاول بعد قليل.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => isDev,
});

module.exports = { globalLimiter, authLimiter, refreshLimiter };