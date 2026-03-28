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
// دالة جلب كل التبرعات (مع دعم الفلاتر)
exports.getItems = async (req, res) => {
    try {
        const { category } = req.query;
        
        // التعديل العبقري تبعك: جلب المتاح والمحجوز (عشان يقدروا يصفوا عالطابور)
        // ومستحيل نجيب "تم التسليم" أو "مخفي"
        let query = { status: { $in: ['متاح', 'محجوز'] } }; 

        if (category) {
            query.category = category;
        }

        const items = await Item.find(query)
            .populate('donor', 'name')
            .sort({ createdAt: -1 });

        res.json(items);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء جلب الأغراض');
    }
};