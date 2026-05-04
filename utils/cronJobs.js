// utils/cronJobs.js
const cron         = require('node-cron');
const User         = require('../models/User');
const Item         = require('../models/Item');
const sendEmail    = require('../utils/sendEmail');
const { generateOtp } = require('../utils/otp');

const initCronJobs = () => {

  // ─── 1. تصفير الكوتا شهرياً (أول يوم بالشهر) ───
  cron.schedule('0 0 1 * *', async () => {
    try {
      await User.updateMany({}, { $set: { quota: 2 } });
      console.log('✅ تم تصفير الكوتا بنجاح!');
    } catch (err) {
      console.error('❌ خطأ في تصفير الكوتا:', err);
    }
  }, { scheduled: true, timezone: "Asia/Amman" });

  // ─── 2. فحص الحجوزات المنتهية كل ساعة ───
  cron.schedule('0 * * * *', async () => {
    try {
      const threshold = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const expiredItems = await Item.find({
        status: 'محجوز',
        bookedAt: { $lt: threshold }
      });

      console.log(`🔍 حجوزات منتهية: ${expiredItems.length}`);

      for (const item of expiredItems) {
        const previousBookerId = item.bookedBy;

        // عقوبة: إضافة الحاجز المهمل لـ cancelledBy
        if (previousBookerId) {
          if (!item.cancelledBy) item.cancelledBy = [];
          const alreadyBanned = item.cancelledBy.some(
            id => id.toString() === previousBookerId.toString()
          );
          if (!alreadyBanned) item.cancelledBy.push(previousBookerId);
        }

        // ─── تمرير الدور للشخص التالي ───
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
              skippedUsers.push(entry.user);
            }
          }

          // حذف من كوتاهم 0 من الـ waitlist
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
          // لا يوجد waitlist — الغرض يرجع متاح
          item.status      = 'متاح';
          item.bookedBy    = null;
          item.deliveryOtp = undefined;
          item.bookedAt    = undefined;
          await item.save();
        }
      }

      if (expiredItems.length > 0)
        console.log(`✅ تمت معالجة ${expiredItems.length} حجز منتهي`);

    } catch (err) {
      console.error('❌ خطأ في فحص الحجوزات:', err);
    }
  }, { scheduled: true, timezone: "Asia/Amman" });

};

module.exports = initCronJobs;