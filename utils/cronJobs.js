const cron = require('node-cron');
const User = require('../models/User');
const Item = require('../models/Item'); // ضفنا موديل الأغراض عشان نشيك عالحجوزات

const initCronJobs = () => {
    // 1️⃣ تصفير الكوتا شهرياً (زي ما هي)
    cron.schedule('0 0 1 * *', async () => {
        try {
            console.log('🔄 جاري تصفير كوتا الحجوزات الشهرية...');
            await User.updateMany({ quota: { $lt: 2 } }, { $set: { quota: 2 } });
            console.log('✅ تم تصفير الكوتا بنجاح!');
        } catch (err) {
            console.error('❌ خطأ في تصفير الكوتا:', err);
        }
    }, { scheduled: true, timezone: "Asia/Amman" });

    // 2️⃣ فحص الحجوزات المنتهية (كل دقيقة عشان التست 🚀)
cron.schedule('0 * * * *', async () => { 
        try {
            // للتست: دقيقة واحدة (60 * 1000) | للرفع: 48 ساعة (48 * 60 * 60 * 1000)
            const threshold = new Date(Date.now() - 72 * 60 * 60 * 1000); 

            const expiredItems = await Item.find({
                status: 'محجوز',
                updatedAt: { $lt: threshold }
            });

            for (const item of expiredItems) {
                // 🛑 ملاحظة: ما بنخصم كوتا هون لأنها انخصمت وقت الحجز وما رح نرجعها
                item.status = 'متاح';
                item.bookedBy = null;
                item.deliveryOtp = undefined;
                await item.save();
                console.log(`♻️ الغرض ${item.title} عاد متاحاً (انتهت مدة الحجز).`);
            }
        } catch (err) {
            console.error('❌ خطأ في فحص الحجوزات:', err);
        }
    }, { scheduled: true, timezone: "Asia/Amman" });

};

module.exports = initCronJobs;