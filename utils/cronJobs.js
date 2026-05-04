// ❌ قبل (يجرب أول شخص فقط):
if (item.waitlist && item.waitlist.length > 0) {
  const nextInLine = item.waitlist.shift();
  const luckyUser = await User.findOne({
    _id: nextInLine.user,
    quota: { $gt: 0 }
  });
  if (luckyUser) {
    // ...
  } else {
    item.status = 'متاح';
    // ...
  }
}

// ✅ بعد (يمر على كل الـ waitlist حتى يجد شخصاً عنده quota):
if (item.waitlist && item.waitlist.length > 0) {
  let luckyUser = null;
  const skippedUsers = [];

  for (const entry of item.waitlist) {
    const candidate = await User.findOneAndUpdate(
      { _id: entry.user, quota: { $gt: 0 } },
      { $inc: { quota: -1 } },
      { new: true }
    );
    if (candidate) {
      luckyUser = candidate;
      break;
    } else {
      skippedUsers.push(entry.user); // كوتاه 0 → نحذفه من الانتظار
    }
  }

  // حذف الأشخاص الذين كوتاهم 0 من الـ waitlist
  if (skippedUsers.length > 0) {
    await Item.findByIdAndUpdate(item._id, {
      $pull: { waitlist: { user: { $in: skippedUsers } } }
    });
  }

  if (luckyUser) {
    const newOtp = generateOtp();
    item.bookedBy    = luckyUser._id;
    item.status      = 'محجوز';
    item.deliveryOtp = newOtp;
    item.bookedAt    = new Date();
    // ⚠️ لا تطرح الكوتا هنا — طرحناها فوق بالـ findOneAndUpdate
    await item.save();
    sendEmail({
      email:   luckyUser.email,
      subject: `وصل دورك في: ${item.title} 🎉`,
      message: `<div dir="rtl">انتهى وقت المستلم السابق، الدور لك الآن! الرمز: <b>${newOtp}</b></div>`
    }).catch(console.error);
  } else {
    item.status      = 'متاح';
    item.bookedBy    = null;
    item.deliveryOtp = undefined;
    item.bookedAt    = undefined;
    await item.save();
  }
} else {
  item.status      = 'متاح';
  item.bookedBy    = null;
  item.deliveryOtp = undefined;
  item.bookedAt    = undefined;
  await item.save();
}