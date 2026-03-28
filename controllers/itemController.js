const Item = require('../models/Item');

// دالة إضافة غرض جديد (تبرع)
exports.createItem = async (req, res) => {
    try {
        // 1. استلام تفاصيل الغرض من الطلب (Postman أو Frontend)
        const { title, description, category, imageUrl } = req.body;

        // 2. بناء الغرض الجديد
        const newItem = new Item({
            title,
            description,
            category,
            imageUrl, // حالياً رح نبعت رابط صورة عادي، لاحقاً بنربطه بـ Cloudinary
            donor: req.user.id // 🪄 السحر هون! أخذنا الـ ID تبع المستخدم من الحارس ولزقناه بالغرض
        });

        // 3. حفظ الغرض بالداتا بيز (Asynchronous زي ما اتفقنا)
        const item = await newItem.save();

        // 4. إرجاع النتيجة
        res.status(201).json({
            msg: 'تم إضافة التبرع بنجاح 🎁',
            item
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء إضافة الغرض');
    }
};