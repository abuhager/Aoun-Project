const Item = require('../models/Item');

// دالة إضافة غرض جديد (تبرع)
exports.createItem = async (req, res) => {
    try {
        // 1. استلام تفاصيل الغرض النصية من الطلب (من form-data)
        // لاحظ: شلنا imageUrl من هون لأنها بتيجي كملف مش كنص
        const { title, description, category } = req.body;

        // 2. استخراج رابط الصورة السحابي (من العتّال Cloudinary)
        let imageUrl = '';
        if (req.file) {
            // العتّال بيرفع الصورة وبحط رابطها السحابي الجاهز هون
            imageUrl = req.file.path; 
        }

        // 3. بناء الغرض الجديد
        const newItem = new Item({
            title,
            description,
            category,
            imageUrl, // هون بنخزن الرابط السحابي الحقيقي اللي إجانا من Cloudinary
            donor: req.user.id // 🪄 السحر هون! أخذنا الـ ID تبع المستخدم من الحارس ولزقناه بالغرض
        });

        // 4. حفظ الغرض بالداتا بيز (Asynchronous زي ما اتفقنا)
        const item = await newItem.save();

        // 5. إرجاع النتيجة
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
            // توليد كود سري من 4 أرقام (مثال: 4829)
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            
            item.status = 'محجوز';
            item.bookedBy = req.user.id;
            item.deliveryOtp = otp; // خزن الكود بالداتا بيز
            
            await item.save();
            
            // بنرجع الكود للطالب في الرسالة عشان يشوفه
            return res.json({ 
                msg: `تم حجز الغرض بنجاح! رمز الاستلام الخاص بك هو: ${otp} 🔐 (أعطه للمتبرع عند المقابلة)`, 
                item 
            });
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
                // بنسحب أول شخص من الطابور
                const nextUser = item.waitlist.shift(); 
                item.bookedBy = nextUser.user; // مبروك للشخص الجديد!
                
                // 🟢 التعديل الأمني: توليد OTP جديد كلياً للشخص الجديد
                const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
                item.deliveryOtp = newOtp;
                
                // (الحالة بتضل 'محجوز')
            } else {
                // ما في حدا بالطابور، الغرض بيرجع للرف
                item.bookedBy = null;
                item.status = 'متاح';
                
                // 🟢 التعديل الأمني: حرق الـ OTP لأنه بطل في حدا حاجز الغرض
                item.deliveryOtp = undefined; 
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
// دالة تعديل بيانات الغرض
exports.updateItem = async (req, res) => {
    try {
        let item = await Item.findById(req.params.id);

        // 1. فحص هل الغرض موجود؟
        if (!item) {
            return res.status(404).json({ msg: 'الغرض غير موجود' });
        }

        // 2. فحص الأمان (حارس الملكية): هل المستخدم الحالي هو نفسه صاحب الغرض؟
        if (item.donor.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'غير مصرح لك بتعديل هذا الغرض 🛑' });
        }

        // 3. استلام البيانات الجديدة من الطلب
        const { title, description, category, imageUrl } = req.body;

        // 4. تحديث الحقول (بنحدث بس الحقول اللي المستخدم بعتها)
        if (title) item.title = title;
        if (description) item.description = description;
        if (category) item.category = category;
        if (imageUrl) item.imageUrl = imageUrl;

        // حفظ التعديلات في الداتا بيز
        await item.save();

        res.json({ msg: 'تم تعديل الغرض بنجاح ✏️', item });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء تعديل الغرض');
    }
};
// دالة حذف الغرض
exports.deleteItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ msg: 'الغرض غير موجود' });
        }

        // فحص الأمان: هل المستخدم الحالي هو صاحب الغرض؟
        if (item.donor.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'غير مصرح لك بحذف هذا الغرض 🛑' });
        }

        // الحذف الفعلي من قاعدة البيانات
        await item.deleteOne();

        res.json({ msg: 'تم حذف الغرض بنجاح 🗑️' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء حذف الغرض');
    }
};
// دالة إتمام تسليم الغرض للطالب (مع نظام OTP)
// دالة إتمام تسليم الغرض للطالب (النسخة الاحترافية مع OTP ورسائل ذكية)
exports.completeDelivery = async (req, res) => {
    try {
        // حماية السيرفر من الكراش إذا ما تم إرسال Body
        const { otp } = req.body || {}; 
        
        const item = await Item.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ msg: 'الغرض غير موجود' });
        }

        // 1. فحص الأمان: لازم المتبرع نفسه هو اللي يأكد التسليم
        if (item.donor.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'غير مصرح لك بتأكيد تسليم هذا الغرض 🛑' });
        }

        // 2. رسائل ذكية حسب حالة الغرض (UX احترافي)
        if (item.status === 'تم التسليم') {
            return res.status(400).json({ msg: 'هذا الغرض تم تسليمه بالفعل مسبقاً! ✅' });
        }

        if (item.status === 'متاح') {
            return res.status(400).json({ msg: 'هذا الغرض متاح ولم يتم حجزه بعد لتسليمه! 🛑' });
        }

        // 3. التحديث الأمني: فحص الـ OTP (لأننا تأكدنا فوق إنو الحالة "محجوز")
        if (!otp || item.deliveryOtp !== otp) {
            return res.status(400).json({ msg: 'رمز التسليم (OTP) غير صحيح أو مفقود! ❌' });
        }

        // 4. إتمام العملية بنجاح
        item.status = 'تم التسليم';
        item.waitlist = []; // تفريغ الطابور لأن الغرض راح لصاحب النصيب
        item.deliveryOtp = undefined; // مسح الكود من الداتا بيز للأمان

        await item.save();

        res.json({ msg: 'تم تسليم الغرض بنجاح، في ميزان حسناتك! 💚', item });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء إتمام التسليم');
    }
};