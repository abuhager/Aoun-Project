const rateLimit = require('express-rate-limit');

// 🛡️ 1. إعداد جدار الحماية (Rate Limiter) العام
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // الوقت: 15 دقيقة
    max: 150, // أقصى حد: 150 طلب لكل IP خلال الـ 15 دقيقة
    message: { msg: '🛑 طلبات كثيرة جداً من جهازك، الرجاء الانتظار قليلاً.' },
    standardHeaders: true, 
    legacyHeaders: false,
});

// 🛡️ 2. إعداد جدار حماية صارم لتسجيل الدخول (لمنع تخمين الباسورد - Brute Force)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // الوقت: ساعة كاملة
    max: 10, // أقصى حد: 10 محاولات تسجيل دخول خاطئة/صحيحة لكل IP
    message: { msg: '🛑 محاولات تسجيل دخول كثيرة، حسابك مقفل مؤقتاً لمدة ساعة.' }
});

// تصدير الجدارين عشان نستخدمهم برا
module.exports = {
    globalLimiter,
    authLimiter
};