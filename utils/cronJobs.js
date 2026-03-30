const cron = require('node-cron');
const User = require('../models/User');

const initCronJobs = () => {
    // 🕒 تصفير الكوتا شهرياً (أول يوم في الشهر الساعة 00:00)
    cron.schedule('0 0 1 * *', async () => {
        try {
            console.log('🔄 جاري تصفير كوتا الحجوزات الشهرية لجميع المستخدمين...');
            const result = await User.updateMany(
                { quota: { $lt: 3 } }, 
                { $set: { quota: 3 } }
            );
            console.log(`✅ تم تصفير الكوتا بنجاح! تم تحديث ${result.modifiedCount} مستخدم.`);
        } catch (err) {
            console.error('❌ خطأ أثناء تصفير الكوتا:', err);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Amman"
    });

    console.log('⏰ تم تفعيل نظام المهام المجدولة (Cron Jobs)');
};

module.exports = initCronJobs;