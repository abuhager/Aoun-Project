const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

// 🛡️ 1. Rate Limiter العام
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 2000 : 150, // dev: مرن | production: صارم
    message: { msg: '🛑 طلبات كثيرة جداً من جهازك، الرجاء الانتظار قليلاً.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev, // ✅ في الـ dev تجاوز الـ limiter كلياً
});

// 🛡️ 2. Rate Limiter للـ auth (Brute Force protection)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: isDev ? 1000 : 10,
    message: { msg: '🛑 محاولات تسجيل دخول كثيرة، حسابك مقفل مؤقتاً لمدة ساعة.' },
    skip: () => isDev,
});

module.exports = { globalLimiter, authLimiter };
