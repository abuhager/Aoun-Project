// backend/repositories/itemRepository.js
const Item = require('../models/Item');

// 1. البحث عن غرض عن طريق الـ ID
exports.findItemById = async (itemId) => {
    return await Item.findById(itemId);
};

// 2. محاولة حجز الغرض بأمان (لمنع ثغرة التعارض Race Condition)
exports.bookItemSafely = async (itemId, userId, updateData) => {
    return await Item.findOneAndUpdate(
        { 
            _id: itemId, 
            status: 'متاح', 
            donor: { $ne: userId } // لا يمكنه حجز غرضه
        },
        updateData,
        { new: true } // عشان يرجع الغرض بعد التحديث
    );
};

// 3. إضافة المستخدم لطابور الانتظار (إذا كان الغرض محجوز)
exports.addToWaitlist = async (itemId, userId) => {
    return await Item.findByIdAndUpdate(
        itemId,
        { $addToSet: { waitlist: userId } }, // addToSet تمنع التكرار
        { new: true }
    );
};