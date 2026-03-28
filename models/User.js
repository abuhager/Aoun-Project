const mongoose = require('mongoose');

// 1. بناء القالب (Schema)
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true, // إجباري
        trim: true      // بشيل أي مسافات بالخطأ قبل أو بعد الاسم
    },
    email: {
        type: String,
        required: true, // إجباري
        unique: true,   // ممنوع يتكرر بالداتا بيز
        trim: true
    },
    password: {
        type: String,
        required: true  // إجباري
    },
    role: {
        type: String,
        default: 'user', // أي شخص بيسجل رح يكون مستخدم عادي تلقائياً
        enum: ['user', 'admin'] // حصر الصلاحيات يا مستخدم يا أدمن
    }
}, {
    // 2. إعدادات إضافية للقالب
    timestamps: true // هاي الإضافة بتخلي مونجو لحالها تسجل متى انعمل الحساب (createdAt) ومتى تعدل (updatedAt)
});

// 3. تصدير القالب عشان نقدر نستخدمه جوا الكنترولر
module.exports = mongoose.model('User', userSchema);