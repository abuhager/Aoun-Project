// backend/services/itemService.js ✅ النسخة المحسّنة

const itemRepository = require("../repositories/itemRepository");
const User = require("../models/User");
const Item = require("../models/Item");
const sendEmail = require("../utils/sendEmail");
const { generateOtp } = require("../utils/otp");
const cloudinary = require("cloudinary").v2;

// إعداد Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ [تحسين 1] دالة مركزية لإرسال الإيميل بدون await + تسجيل الأخطاء
function fireSendEmail(options) {
  sendEmail(options).catch(err =>
    console.error(`[Email Error] to: ${options.email} | subject: "${options.subject}" |`, err.message)
  );
}

// دالة مساعدة لرفع الصور على Cloudinary
function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "aoun_items" },
      (error, result) => (result ? resolve(result) : reject(error))
    );
    stream.end(buffer);
  });
}

// ─────────────────────────────────────────
// 1. منطق حجز الغرض
// ─────────────────────────────────────────
exports.bookItemLogic = async (itemId, userId) => {
  const unrated = await Item.findOne({
    bookedBy: userId, status: "تم التسليم", isRated: false,
  });
  if (unrated) throw new Error(`قيّم غرض (${unrated.title}) أولاً لتعزيز مجتمع الثقة 💚`);

  const item = await itemRepository.findItemById(itemId);
  if (!item) throw new Error("الغرض غير موجود أو تم حذفه.");
  if (item.donor.toString() === userId.toString())
    throw new Error("لا يمكنك حجز الغرض الذي قمت بالتبرع به.");

  if ((item.cancelledBy || []).some((id) => id.toString() === userId))
    throw new Error("لا يمكنك حجز هذا الغرض مجدداً بعد إلغائه 🚫");

  const user = await User.findById(userId);
  if (user.quota <= 0) throw new Error("عذراً، لقد استنفدت حصتك (الكوتا) لهذا الشهر.");

  const otp = generateOtp();
  const bookedItem = await itemRepository.bookItemSafely(itemId, userId, {
    status: "محجوز",
    bookedBy: userId,
    deliveryOtp: otp,
    bookedAt: new Date(),
  });

  if (!bookedItem) {
    await itemRepository.addToWaitlist(itemId, userId);
    return { status: "waitlist", message: "سبقك أحدهم! تمت إضافتك لطابور الانتظار بنجاح." };
  }

  user.quota -= 1;
  await user.save();

  // ✅ fire-and-forget مع تسجيل الأخطاء
  fireSendEmail({
    email: user.email,
    subject: `تأكيد حجز: ${bookedItem.title} 🎁`,
    message: `<div dir="rtl">تهانينا! أصبح الغرض محجوزاً لك.<br>رمز الاستلام: <b>${otp}</b><p>لديك 72 ساعة لإتمام الاستلام ⏱️</p></div>`,
  });

  return { status: "booked", message: "تم الحجز بنجاح.", otp, item: bookedItem };
};

// ─────────────────────────────────────────
// 2. منطق إضافة غرض جديد
// ─────────────────────────────────────────
exports.createItemLogic = async (itemData, userId, file) => {
  if (!file) throw new Error("صورة الغرض مطلوبة.");

  const uploadResult = await uploadToCloudinary(file.buffer);

  const newItemData = {
    title: itemData.title,
    category: itemData.category,
    description: itemData.description,
    location: itemData.location,
    condition: itemData.condition,
    imageUrl: uploadResult.secure_url,
    cloudinaryId: uploadResult.public_id,
    donor: userId,
    status: "متاح",
  };

  const createdItem = await itemRepository.createItem(newItemData);
  return { message: "تم إضافة الغرض بنجاح", item: createdItem };
};

// ─────────────────────────────────────────
// 3. منطق جلب جميع الأغراض (Pagination)
// ─────────────────────────────────────────
exports.getItemsLogic = async (queryFilters) => {
  const { category, location, page = 1, limit: rawLimit } = queryFilters;
  const limit = Math.min(parseInt(rawLimit) || 12, 50);
  const query = { status: { $in: ["متاح", "محجوز"] } };

  if (category) query.category = category;
  if (location) query.location = location;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    itemRepository.findItemsWithPagination(query, skip, limit),
    itemRepository.countItems(query),
  ]);

  return { items, total, page: parseInt(page), pages: Math.ceil(total / limit) };
};

// ─────────────────────────────────────────
// 4. منطق جلب الأغراض الشخصية
// ─────────────────────────────────────────
exports.getMyItemsLogic = async (userId) => {
  const [user, donations, requests] = await Promise.all([
    User.findById(userId)
      .select("name email trustScore phone quota isVerifiedStudent")
      .lean(),
    itemRepository.findDonationsByUser(userId),
    itemRepository.findRequestsByUser(userId),
  ]);

  return {
    user,
    myDonations: donations.map((i) => ({
      ...i,
      otp: i.status === "محجوز" ? i.deliveryOtp : undefined,
    })),
    myRequests: requests.map((i) => ({
      ...i,
      otp: i.status === "محجوز" ? i.deliveryOtp : undefined,
    })),
  };
};

// ─────────────────────────────────────────
// 5. منطق جلب تفاصيل غرض واحد
// ─────────────────────────────────────────
exports.getItemByIdLogic = async (itemId, requesterId) => {
  const item = await itemRepository.findItemDetails(itemId);
  if (!item) throw new Error("الغرض غير موجود");

  const itemObj = item.toObject();
  if (!requesterId || itemObj.bookedBy?.toString() !== requesterId) {
    delete itemObj.deliveryOtp;
  }

  return itemObj;
};

// ─────────────────────────────────────────
// 6. منطق إلغاء الحجز والتعامل مع الطابور
// ─────────────────────────────────────────
exports.cancelBookingLogic = async (itemId, userId) => {
  const item = await itemRepository.findItemForAction(itemId);
  if (!item) throw new Error("الغرض غير موجود");

  const isBooker = item.bookedBy && item.bookedBy.toString() === userId;
  const isDonor  = item.donor.toString() === userId;
  const inWait   = item.waitlist.some((w) => w.user.toString() === userId);

  if (!isBooker && !isDonor && !inWait) throw new Error("غير مصرح لك");

  // الانسحاب من الانتظار فقط
  if (inWait && !isBooker && !isDonor) {
    await Item.findByIdAndUpdate(item._id, {
      $pull: { waitlist: { user: userId } },
    });
    return { msg: "تم انسحابك من قائمة الانتظار بنجاح 🚶‍♂️" };
  }

  // إعادة الكوتا للحاجز السابق
  if (item.bookedBy) {
    await User.findByIdAndUpdate(item.bookedBy, { $inc: { quota: 1 } });
  }

  // فحص طابور الانتظار وتمرير الدور
  if (item.waitlist.length > 0) {
    let nextValidUser = null;
    const usersToRemove = [];

    for (const waiting of item.waitlist) {
      nextValidUser = await User.findOneAndUpdate(
        { _id: waiting.user, quota: { $gt: 0 } },
        { $inc: { quota: -1 } },
        { new: true }
      );
      if (nextValidUser) break;
      else usersToRemove.push(waiting.user);
    }

    if (usersToRemove.length > 0) {
      await Item.findByIdAndUpdate(item._id, {
        $pull: { waitlist: { user: { $in: usersToRemove } } },
      });
    }

    if (nextValidUser) {
      const newOtp = generateOtp();
      await Item.findByIdAndUpdate(item._id, {
        $set: {
          status: "محجوز",
          bookedBy: nextValidUser._id,
          deliveryOtp: newOtp,
          bookedAt: new Date(),
        },
        $addToSet: { cancelledBy: item.bookedBy },
        $pull: { waitlist: { user: nextValidUser._id } },
      });

      fireSendEmail({
        email: nextValidUser.email,
        subject: `الدور وصلك في "عون" 🎉`,
        message: `<div dir="rtl">أصبح الغرض محجوزاً لك! رمز الاستلام: <b>${newOtp}</b><p>لديك 72 ساعة لإتمام الاستلام ⏱️</p></div>`,
      });
      return { msg: "تم إلغاء الحجز وتمرير الدور للشخص التالي 🔄" };
    }
  }

  // لا يوجد منتظرون — الغرض يعود متاحاً
  await Item.findByIdAndUpdate(item._id, {
    $set: { status: "متاح", bookedBy: null, deliveryOtp: null, bookedAt: null },
    $addToSet: { cancelledBy: item.bookedBy },
  });
  return { msg: "تم إلغاء الحجز والقطعة متاحة الآن ✅" };
};

// ─────────────────────────────────────────
// 7. منطق إتمام التسليم
// ─────────────────────────────────────────
exports.completeDeliveryLogic = async (itemId, userId, otp) => {
  const item = await itemRepository.findItemForAction(itemId);
  if (!item || item.donor.toString() !== userId) throw new Error("غير مصرح لك");
  if (String(item.deliveryOtp).trim() !== String(otp).trim())
    throw new Error("الرمز خطأ ❌");

  item.status     = "تم التسليم";
  item.deliveryOtp = undefined;
  item.bookedAt    = undefined;
  await item.save();

  const receiver = await User.findById(item.bookedBy);
  if (receiver)
    fireSendEmail({
      email: receiver.email,
      subject: `تم استلام الغرض 🎁`,
      message: `<div dir="rtl">شكراً لك! لقد تم تأكيد استلامك للغرض. لا تنسَ تقييم المتبرع لدعمه 💚</div>`,
    });

  return { msg: "تم التسليم! 💚", item };
};

// ─────────────────────────────────────────
// 8. منطق التقييم
// ─────────────────────────────────────────
exports.rateItemLogic = async (itemId, userId, rating) => {
  const item = await Item.findById(itemId);

  // ✅ [تحسين 2] Optional chaining لتفادي TypeError إذا كانت bookedBy فارغة
  if (!item || item.bookedBy?.toString() !== userId) throw new Error("غير مصرح لك");
  if (item.status !== "تم التسليم" || item.isRated)  throw new Error("لا يمكن التقييم الآن");

  const donor  = await User.findById(item.donor);
  const points = rating >= 5 ? 5 : rating >= 3 ? 2 : -5;
  donor.trustScore = Math.min(100, Math.max(0, (donor.trustScore || 85) + points));
  item.isRated = true;

  await Promise.all([item.save(), donor.save()]);
  return { msg: "تم التقييم 🌟", trustScore: donor.trustScore };
};

// ─────────────────────────────────────────
// 9. منطق التبليغ
// ─────────────────────────────────────────
exports.reportUserLogic = async (reportedUserId, reporterId) => {
  if (reporterId === reportedUserId) throw new Error("لا يمكنك التبليغ عن نفسك");

  const user = await User.findById(reportedUserId);
  if (!user) throw new Error("المستخدم غير موجود");
  if ((user.reportedBy || []).some((id) => id.toString() === reporterId))
    throw new Error("لقد قمت بالتبليغ عن هذا المستخدم مسبقاً 🚫");

  user.reportedBy.push(reporterId);
  const total = user.reportedBy.length;

  if (total >= 6) {
    user.isBanned = true;
  } else if (total >= 2) {
    user.trustScore = Math.max(0, (user.trustScore || 85) - total * 5);
  }

  await user.save();
  return { msg: "تم إرسال البلاغ بنجاح 🛡️" };
};

// ─────────────────────────────────────────
// 10. منطق تعديل الغرض
// ─────────────────────────────────────────
exports.updateItemLogic = async (itemId, userId, updateData, file) => {
  const item = await itemRepository.findItemForUpdate(itemId, userId);
  if (!item) throw new Error("الغرض غير موجود أو لا تملك صلاحية تعديله");

  if (file) {
    // حذف الصورة القديمة أولاً لتوفير المساحة
    if (item.cloudinaryId) {
      await cloudinary.uploader.destroy(item.cloudinaryId).catch(console.error);
    }
    const uploadResult = await uploadToCloudinary(file.buffer);
    item.imageUrl     = uploadResult.secure_url;
    item.cloudinaryId = uploadResult.public_id;
  }

  Object.assign(item, updateData);
  await item.save();
  return { msg: "تم التعديل بنجاح ✨", item };
};

// ─────────────────────────────────────────
// 11. منطق حذف الغرض
// ─────────────────────────────────────────
exports.deleteItemLogic = async (itemId, userId, userRole) => {
  const item = await Item.findById(itemId);
  if (!item || (item.donor.toString() !== userId && userRole !== "admin"))
    throw new Error("غير مصرح لك بحذف هذا الغرض");

  // حذف الصورة من Cloudinary
  if (item.cloudinaryId) {
    await cloudinary.uploader.destroy(item.cloudinaryId).catch(console.error);
  }

  if (item.status === "محجوز" && item.bookedBy) {
    // ✅ [تحسين 3] Promise.all لأن العمليتين مستقلتان — أسرع بالتوازي
    const [receiver] = await Promise.all([
      User.findByIdAndUpdate(item.bookedBy, { $inc: { quota: 1 } }, { new: true }),
      User.findByIdAndUpdate(item.donor,    { $inc: { trustScore: -3 } }),
    ]);

    if (receiver)
      fireSendEmail({
        email: receiver.email,
        subject: `تحديث بخصوص حجزك ⚠️`,
        message: `<div dir="rtl">نأسف لإبلاغك بأن المتبرع قام بحذف الغرض (<b>${item.title}</b>). لقد تم استرداد حصتك (الكوتا) تلقائياً 💚</div>`,
      });
  }

  await itemRepository.deleteItemById(item);
  return { msg: "تم حذف الغرض نهائياً ⚖️" };
};