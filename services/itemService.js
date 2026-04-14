// backend/services/itemService.js
const itemRepository = require('../repositories/itemRepository');
const User = require('../models/User'); // مؤقتاً بنناديه مباشرة لحد ما نعمل userRepository
const crypto = require('crypto');

exports.bookItemLogic = async (itemId, userId) => {
    // 1. التأكد إنو الغرض موجود
    const item = await itemRepository.findItemById(itemId);
    if (!item) {
        throw new Error('الغرض غير موجود أو تم حذفه.');
    }

    // 2. منع المستخدم من حجز غرضه
    if (item.donor.toString() === userId.toString()) {
        throw new Error('لا يمكنك حجز الغرض الذي قمت بالتبرع به.');
    }

    // 3. فحص الكوتا للمستخدم
    const user = await User.findById(userId);
    if (user.quota <= 0) {
        throw new Error('عذراً، لقد استنفدت حصتك (الكوتا) لهذا الشهر.');
    }

    // 4. توليد رمز OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // 5. محاولة الحجز الفعلي
    const bookedItem = await itemRepository.bookItemSafely(itemId, userId, {
        status: 'محجوز',
        receiver: userId,
        deliveryOtp: otp,
        reservedAt: new Date()
    });

    // 6. التعامل مع حالة (شخص آخر سبقه بأجزاء من الثانية) -> تحويله للطابور
    if (!bookedItem) {
        await itemRepository.addToWaitlist(itemId, userId);
        return { 
            status: 'waitlist', 
            message: 'سبقك أحدهم! تمت إضافتك لطابور الانتظار بنجاح.' 
        };
    }

    // 7. إذا تم الحجز بنجاح -> خصم الكوتا
    user.quota -= 1;
    await user.save();

    return { 
        status: 'booked', 
        message: 'تم الحجز بنجاح.', 
        otp: otp,
        item: bookedItem 
    };
};