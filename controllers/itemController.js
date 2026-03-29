const Item = require('../models/Item');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// 1. جلب كل التبرعات (لصفحة Browse)
exports.getItems = async (req, res) => {
    try {
        const { category, location } = req.query;
        let query = { status: { $in: ['متاح', 'محجوز'] } }; 

        if (category) query.category = category;
        if (location) query.location = location;

        const items = await Item.find(query)
            .populate('donor', 'name trustScore avatar') 
            .sort({ createdAt: -1 });

        res.json(items);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء جلب الأغراض');
    }
};

// 2. جلب أغراضي الشخصية (للـ Dashboard)
exports.getMyItems = async (req, res) => {
    try {
        // جلب بيانات اليوزر صاحب التوكن
        const user = await User.findById(req.user.id).select('name email');
        
        const myDonations = await Item.find({ donor: req.user.id }).sort({ createdAt: -1 });
        const myRequests = await Item.find({ bookedBy: req.user.id }).sort({ createdAt: -1 });

        // نبعت اليوزر مع المصفوفات
        res.json({ user, myDonations, myRequests });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};

// 3. جلب غرض واحد بالتفصيل
exports.getItemById = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id)
            .populate('donor', 'name trustScore avatar location isVerified');

        if (!item) {
            return res.status(404).json({ msg: 'هذا الغرض غير موجود' });
        }
        res.json(item);
    } catch (err) {
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'تنسيق الـ ID غير صحيح' });
        res.status(500).send('خطأ في السيرفر');
    }
};

// 4. إضافة غرض جديد
exports.createItem = async (req, res) => {
    try {
        const { title, description, category, location, condition, specs } = req.body;

        let imageUrl = '';
        if (req.file) {
            imageUrl = req.file.path; 
        }

        const newItem = new Item({
            title,
            description,
            category,
            location,
            condition,
            specs, 
            imageUrl,
            donor: req.user.id 
        });

        const item = await newItem.save();
        res.status(201).json({ msg: 'تم إضافة التبرع بنجاح 🎁', item });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء إضافة الغرض');
    }
};

// 5. حجز غرض (Booking)
exports.bookItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        if (item.donor.toString() === req.user.id) {
            return res.status(400).json({ msg: 'لا يمكنك حجز غرض قمت بتبرعه بنفسك' });
        }

        if (item.status === 'متاح') {
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            item.status = 'محجوز';
            item.bookedBy = req.user.id;
            item.deliveryOtp = otp; 
            await item.save();
            
            return res.json({ 
                msg: `تم حجز الغرض بنجاح! رمز الاستلام هو: ${otp} 🔐`, 
                item 
            });
        } else {
            // نظام قائمة الانتظار
            const alreadyInWaitlist = item.waitlist.some(wait => wait.user.toString() === req.user.id);
            if (alreadyInWaitlist) return res.status(400).json({ msg: 'أنت مسجل بالفعل في قائمة الانتظار' });

            item.waitlist.push({ user: req.user.id });
            await item.save();
            return res.json({ msg: 'الغرض محجوز حالياً، تم إضافتك لقائمة الانتظار 🕒', item });
        }
    } catch (err) {
        res.status(500).send('خطأ في السيرفر أثناء الحجز');
    }
};

// 6. 🟢 إلغاء الحجز والانسحاب من الطابور (التعديل صار هون)
exports.cancelBooking = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        const userId = req.user.id;

        // 🟢 الحالة الأولى: اليوزر هو الشخص اللي حاجز القطعة فعلياً
        if (item.bookedBy && item.bookedBy.toString() === userId) {
            if (item.waitlist.length > 0) {
                const nextUser = item.waitlist.shift(); // بنسحب أول واحد بالطابور نعطيه الغرض
                const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
                item.bookedBy = nextUser.user;
                item.deliveryOtp = newOtp;
            } else {
                item.bookedBy = null;
                item.status = 'متاح';
                item.deliveryOtp = undefined; 
            }
            await item.save();
            return res.json({ msg: 'تم إلغاء حجزك بنجاح', item });
        }

        // 🟢 الحالة الثانية: اليوزر موجود بالطابور (Waitlist) وبده ينسحب
        const inWaitlistIndex = item.waitlist.findIndex(wait => wait.user.toString() === userId);
        if (inWaitlistIndex !== -1) {
            item.waitlist.splice(inWaitlistIndex, 1); // بنمسح اليوزر من الطابور
            await item.save();
            return res.json({ msg: 'تم انسحابك من طابور الانتظار بنجاح 🚶‍♂️', item });
        }

        // إذا ما كان حاجز ولا بالطابور
        res.status(400).json({ msg: 'أنت لست الشخص الذي حجز هذا الغرض ولست في الطابور' });
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
};

// 7. إتمام التسليم (عن طريق المتبرع باستخدام الـ OTP)
exports.completeDelivery = async (req, res) => {
    try {
        const { otp } = req.body; 
        const item = await Item.findById(req.params.id);
        
        // 1. التأكد إن الغرض موجود وإن اليوزر هو المتبرع نفسه
        if (!item || item.donor.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'غير مصرح لك بإتمام عملية التسليم' });
        }

        // 2. التأكد إن القطعة أصلاً محجوزة
        if (item.status !== 'محجوز') {
            return res.status(400).json({ msg: 'هذا الغرض ليس محجوزاً لتتم عملية تسليمه' });
        }

        // 3. مقارنة الـ OTP (مع تنظيف المسافات وتحويلها لنص لضمان التطابق 100%)
        const savedOtp = String(item.deliveryOtp).trim();
        const enteredOtp = String(otp).trim();

        if (savedOtp !== enteredOtp) {
            return res.status(400).json({ msg: 'الرمز الذي أدخلته غير صحيح ❌' });
        }

        // 4. إذا الرمز صح، بنغير الحالة وبنحذف الـ OTP
        item.status = 'تم التسليم';
        item.deliveryOtp = undefined;
        await item.save();

        res.json({ msg: 'تم تسليم الغرض بنجاح! شكراً لعطائك 💚', item });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء تأكيد التسليم');
    }
};

// 8. تعديل الغرض
exports.updateItem = async (req, res) => {
    try {
        let item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        // التأكد إنه صاحب الغرض
        if (item.donor.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'غير مصرح لك بتعديل هذا الغرض' });
        }

        // لا يمكن تعديل غرض تم حجزه أو تسليمه
        if (item.status !== 'متاح') {
            return res.status(400).json({ msg: 'لا يمكن تعديل غرض محجوز أو تم تسليمه' });
        }

        item = await Item.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json({ msg: 'تم تعديل الغرض بنجاح', item });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};

// 9. حذف الغرض
exports.deleteItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        // هون بتيجي صلاحيات الأدمن: يقدر يحذف إما صاحب القطعة أو الأدمن
        if (item.donor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ msg: 'غير مصرح لك بحذف هذا الغرض' });
        }

        await item.deleteOne();
        res.json({ msg: 'تم حذف الغرض بنجاح' });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};