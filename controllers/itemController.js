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
// دالة حجز غرض أو الانضمام للطابور
exports.bookItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ msg: 'الغرض غير موجود' });
        }

        // 1. فحص: ممنوع تحجز غرض إنت اللي منزله (تبرعك الشخصي)
        if (item.donor.toString() === req.user.id) {
            return res.status(400).json({ msg: 'لا يمكنك حجز غرض قمت بتبرعه بنفسك' });
        }

        // 2. فحص: هل المستخدم أصلاً هو اللي حجز الغرض أو موجود بالطابور؟
        const alreadyInWaitlist = item.waitlist.some(wait => wait.user.toString() === req.user.id);
        const isBooker = item.bookedBy && item.bookedBy.toString() === req.user.id;

        if (alreadyInWaitlist || isBooker) {
            return res.status(400).json({ msg: 'أنت مسجل بالفعل في قائمة هذا الغرض' });
        }

        // 3. لوجيك الحجز:
        if (item.status === 'متاح') {
            // إذا متاح، بصير محجوز فوراً للشخص هاد
            item.status = 'محجوز';
            item.bookedBy = req.user.id;
            await item.save();
            return res.json({ msg: 'تم حجز الغرض بنجاح، تواصل مع المتبرع 🤝', item });
        } else if (item.status === 'محجوز') {
            // إذا محجوز، بنضيف الشخص للطابور (Waitlist)
            item.waitlist.push({ user: req.user.id });
            await item.save();
            return res.json({ msg: 'الغرض محجوز حالياً، تم إضافتك لقائمة الانتظار 🕒', item });
        } else {
            return res.status(400).json({ msg: 'هذا الغرض غير متوفر للحجز حالياً' });
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء الحجز');
    }
};
// دالة إلغاء الحجز أو الخروج من الطابور
exports.cancelBooking = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ msg: 'الغرض غير موجود' });
        }

        const userId = req.user.id;

        // السيناريو الأول: المستخدم هو الشخص اللي حاجز الغرض فعلياً
        if (item.bookedBy && item.bookedBy.toString() === userId) {
            // هل في حدا بيستنى بالطابور؟
            if (item.waitlist.length > 0) {
                // بنسحب أول شخص من الطابور (shift بتحذف أول عنصر من المصفوفة وبترجعه)
                const nextUser = item.waitlist.shift(); 
                item.bookedBy = nextUser.user; // مبروك للشخص الجديد!
                // الحالة بتضل 'محجوز'
            } else {
                // ما في حدا بالطابور، الغرض بيرجع للرف
                item.bookedBy = null;
                item.status = 'متاح';
            }
            
            await item.save();
            return res.json({ msg: 'تم إلغاء حجزك بنجاح', item });
        }

        // السيناريو الثاني: المستخدم مش هو الحاجز الأساسي، بس موجود بالطابور
        const inWaitlist = item.waitlist.some(wait => wait.user.toString() === userId);
        
        if (inWaitlist) {
            // بنفلتر المصفوفة وبنشيل هاد المستخدم منها
            item.waitlist = item.waitlist.filter(wait => wait.user.toString() !== userId);
            await item.save();
            return res.json({ msg: 'تم إزالتك من قائمة الانتظار بنجاح', item });
        }

        // السيناريو الثالث: المستخدم لا حاجز ولا بالطابور وبجرب يلغي!
        return res.status(400).json({ msg: 'أنت لست مسجلاً في هذا الغرض لإلغائه' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء إلغاء الحجز');
    }
};