const Item = require('../models/Item');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// 1. جلب كل التبرعات (مع دعم الفلاتر)
exports.getItems = async (req, res) => {
    try {
        const { category, location } = req.query;
        let query = { status: { $in: ['متاح', 'محجوز'] } }; 

        if (category) query.category = category;
        if (location) query.location = location;

        const items = await Item.find(query)
            .populate('donor', 'name trustScore') // جلب بيانات المتبرع
            .sort({ createdAt: -1 });

        res.json(items);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء جلب الأغراض');
    }
};

// 2. 🟢 (الجديدة) جلب غرض واحد بناءً على الـ ID
exports.getItemById = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id)
            .populate('donor', 'name trustScore avatar location isVerified'); // جلب بيانات كاملة للمتبرع

        if (!item) {
            return res.status(404).json({ msg: 'هذا الغرض غير موجود' });
        }
        res.json(item);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'تنسيق الـ ID غير صحيح' });
        res.status(500).send('خطأ في السيرفر');
    }
};

// 3. إضافة غرض جديد (تبرع)
exports.createItem = async (req, res) => {
    try {
        // أضفنا الحقول الجديدة (location, condition, specs) لتطابق الفرونت إند
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

// 4. حجز غرض أو الانضمام للطابور
exports.bookItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        if (item.donor.toString() === req.user.id) {
            return res.status(400).json({ msg: 'لا يمكنك حجز غرض قمت بتبرعه بنفسك' });
        }

        const alreadyInWaitlist = item.waitlist.some(wait => wait.user.toString() === req.user.id);
        const isBooker = item.bookedBy && item.bookedBy.toString() === req.user.id;

        if (alreadyInWaitlist || isBooker) {
            return res.status(400).json({ msg: 'أنت مسجل بالفعل في قائمة هذا الغرض' });
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
            item.waitlist.push({ user: req.user.id });
            await item.save();
            return res.json({ msg: 'الغرض محجوز حالياً، تم إضافتك لقائمة الانتظار 🕒', item });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء الحجز');
    }
};

// 5. إلغاء الحجز
exports.cancelBooking = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        const userId = req.user.id;

        if (item.bookedBy && item.bookedBy.toString() === userId) {
            if (item.waitlist.length > 0) {
                const nextUser = item.waitlist.shift(); 
                const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
                
                item.bookedBy = nextUser.user;
                item.deliveryOtp = newOtp;
                
                const luckyUser = await User.findById(nextUser.user);
                if (luckyUser) {
                    const message = `<h2>دورك وصل يا ${luckyUser.name}! 🎉</h2><p>كود الاستلام: <b>${newOtp}</b></p>`;
                    await sendEmail({ email: luckyUser.email, subject: 'الغرض متاح لك الآن 🎁', message });
                }
            } else {
                item.bookedBy = null;
                item.status = 'متاح';
                item.deliveryOtp = undefined; 
            }
            await item.save();
            return res.json({ msg: 'تم إلغاء حجزك بنجاح', item });
        }

        // إزالة من الطابور
        const inWaitlist = item.waitlist.some(wait => wait.user.toString() === userId);
        if (inWaitlist) {
            item.waitlist = item.waitlist.filter(wait => wait.user.toString() !== userId);
            await item.save();
            return res.json({ msg: 'تم إزالتك من قائمة الانتظار', item });
        }

        return res.status(400).json({ msg: 'أنت لست مسجلاً في هذا الغرض' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر');
    }
};

// 6. تعديل وحذف وإتمام التسليم
exports.updateItem = async (req, res) => {
    try {
        let item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });
        if (item.donor.toString() !== req.user.id) return res.status(401).json({ msg: 'غير مصرح لك' });

        const { title, description, category, location, condition, specs } = req.body;
        if (title) item.title = title;
        if (description) item.description = description;
        if (category) item.category = category;
        if (location) item.location = location;
        if (condition) item.condition = condition;
        if (specs) item.specs = typeof specs === 'string' ? JSON.parse(specs) : specs;

        await item.save();
        res.json({ msg: 'تم التعديل بنجاح ✏️', item });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item || item.donor.toString() !== req.user.id) return res.status(401).json({ msg: 'فشل الحذف' });
        await item.deleteOne();
        res.json({ msg: 'تم الحذف 🗑️' });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};

exports.completeDelivery = async (req, res) => {
    try {
        const { otp } = req.body || {}; 
        const item = await Item.findById(req.params.id);
        if (!item || item.donor.toString() !== req.user.id) return res.status(401).json({ msg: 'غير مصرح لك' });

        if (item.deliveryOtp !== otp) return res.status(400).json({ msg: 'الرمز غير صحيح ❌' });

        item.status = 'تم التسليم';
        item.waitlist = [];
        item.deliveryOtp = undefined;
        await item.save();

        res.json({ msg: 'تم تسليم الغرض بنجاح! 💚', item });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};