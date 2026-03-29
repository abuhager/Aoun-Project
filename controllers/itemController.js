const Item = require('../models/Item');
const User = require('../models/User');

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
        res.status(500).send('خطأ في السيرفر أثناء جلب الأغراض');
    }
};

// 2. 🟢 جلب أغراضي الشخصية (للـ Dashboard) - تم التعديل هنا
exports.getMyItems = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('name email trustScore phone'); 
        
        // استخدمنا lean() عشان نقدر نعدل على الداتا قبل ما نبعتها للفرونت إند
        const myDonationsDocs = await Item.find({ donor: req.user.id })
            .populate('bookedBy', 'name avatar trustScore email phone') 
            .select('+deliveryOtp') // نجبره يجيب الرمز إذا كان مخفي بالـ Schema
            .sort({ createdAt: -1 })
            .lean();

        const myRequestsDocs = await Item.find({ bookedBy: req.user.id })
            .populate('donor', 'name avatar trustScore email phone')
            .select('+deliveryOtp') // نجبره يجيب الرمز
            .sort({ createdAt: -1 })
            .lean();

        // 🟢 السحر هون: بنسخ البيانات وبنغير اسم حقل الـ deliveryOtp لـ otp عشان الفرونت يقرأه صح
        const myDonations = myDonationsDocs.map(item => ({ ...item, otp: item.deliveryOtp }));
        const myRequests = myRequestsDocs.map(item => ({ ...item, otp: item.deliveryOtp }));

        res.json({ user, myDonations, myRequests });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};

// 3. جلب غرض واحد بالتفصيل
exports.getItemById = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id)
            .populate('donor', 'name phone trustScore avatar location isVerified')
            .populate('waitlist.user', 'name avatar');

        if (!item) return res.status(404).json({ msg: 'هذا الغرض غير موجود' });
        res.json(item);
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};

// 4. إضافة غرض جديد
exports.createItem = async (req, res) => {
    try {
        const { title, description, category, location, condition } = req.body;
        let imageUrl = req.file ? req.file.path : '';

        const newItem = new Item({
            title, description, category, location, condition,  imageUrl,
            donor: req.user.id 
        });

        const item = await newItem.save();
        res.status(201).json({ msg: 'تم إضافة التبرع بنجاح 🎁', item });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر أثناء إضافة الغرض');
    }
};

// 5. حجز غرض (Booking + Waitlist Logic) 🚀
exports.bookItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        if (item.donor.toString() === req.user.id) {
            return res.status(400).json({ msg: 'لا يمكنك حجز غرض قمت بتبرعه بنفسك' });
        }

        // الحالة أ: الغرض متاح تماماً
        if (item.status === 'متاح') {
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            item.status = 'محجوز';
            item.bookedBy = req.user.id;
            item.deliveryOtp = otp; 
            await item.save();
            
            return res.json({ 
                msg: `تم حجز الغرض بنجاح! رمز الاستلام: ${otp} 🔐`, 
                item 
            });
        } 
        
        // الحالة ب: الغرض محجوز -> دخول قائمة الانتظار
        const alreadyInWaitlist = item.waitlist.some(wait => wait.user.toString() === req.user.id);
        if (alreadyInWaitlist) return res.status(400).json({ msg: 'أنت مسجل بالفعل في قائمة الانتظار' });
        if (item.bookedBy?.toString() === req.user.id) return res.status(400).json({ msg: 'أنت من يحجز هذا الغرض حالياً' });

        item.waitlist.push({ user: req.user.id });
        await item.save();
        return res.json({ msg: 'الغرض محجوز حالياً، تم إضافتك لقائمة الانتظار 🕒', item, inWaitlist: true });

    } catch (err) {
        res.status(500).send('خطأ في السيرفر أثناء الحجز');
    }
};

// 6. إلغاء الحجز والانسحاب من الطابور (المنطق الذكي) 🔄
exports.cancelBooking = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        const userId = req.user.id;

        // الحالة الأولى: الشخص الأساسي هو اللي كنسل
        if (item.bookedBy && item.bookedBy.toString() === userId) {
            if (item.waitlist.length > 0) {
                // سحب أول واحد من الطابور وتعيينه كمستلم جديد
                const nextInLine = item.waitlist.shift(); 
                const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
                
                item.bookedBy = nextInLine.user;
                item.deliveryOtp = newOtp;
                // الحالة بضل "محجوز"
                await item.save();
                return res.json({ msg: 'تم إلغاء حجزك وتمرير الغرض للشخص التالي في الانتظار 🔄', item });
            } else {
                // الطابور فاضي -> رجعه متاح
                item.bookedBy = null;
                item.status = 'متاح';
                item.deliveryOtp = undefined; 
                await item.save();
                return res.json({ msg: 'تم إلغاء حجزك بنجاح، الغرض متاح الآن للجميع', item });
            }
        }

        // الحالة الثانية: شخص في الـ Waitlist قرر ينسحب
        const waitIndex = item.waitlist.findIndex(w => w.user.toString() === userId);
        if (waitIndex !== -1) {
            item.waitlist.splice(waitIndex, 1);
            await item.save();
            return res.json({ msg: 'تم انسحابك من قائمة الانتظار بنجاح 🚶‍♂️', item });
        }

        res.status(400).json({ msg: 'أنت لست الشخص الحاجز ولا في قائمة الانتظار' });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};

// 7. إتمام التسليم (بالـ OTP)
exports.completeDelivery = async (req, res) => {
    try {
        const { otp } = req.body; 
        const item = await Item.findById(req.params.id);
        
        if (!item || item.donor.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'غير مصرح لك بإتمام عملية التسليم' });
        }

        if (item.status !== 'محجوز') {
            return res.status(400).json({ msg: 'هذا الغرض ليس محجوزاً حالياً' });
        }

        if (String(item.deliveryOtp).trim() !== String(otp).trim()) {
            return res.status(400).json({ msg: 'الرمز الذي أدخلته غير صحيح ❌' });
        }

        item.status = 'تم التسليم';
        item.deliveryOtp = undefined; 
        await item.save();

        res.json({ msg: 'تم تسليم الغرض بنجاح! شكراً لعطائك 💚', item });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر أثناء تأكيد التسليم');
    }
};

// 8. تقييم العملية وتحديث الـ Trust Score 🌟
exports.rateItem = async (req, res) => {
    try {
        const { rating } = req.body; 
        const item = await Item.findById(req.params.id);

        if (!item || item.bookedBy.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'فقط المستلم يمكنه التقييم' });
        }

        if (item.status !== 'تم التسليم' || item.isRated) {
            return res.status(400).json({ msg: 'لا يمكنك التقييم حالياً' });
        }

        const donor = await User.findById(item.donor);
        let points = rating >= 5 ? 5 : (rating >= 3 ? 2 : -5);

        donor.trustScore = Math.min(100, Math.max(0, (donor.trustScore || 85) + points));
        await donor.save();

        item.isRated = true;
        await item.save();

        res.json({ msg: 'تم التقييم وتحديث نقاط المتبرع 🌟', trustScore: donor.trustScore });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر أثناء التقييم');
    }
};

// 9. التبليغ عن مستخدم 🛡️
exports.reportUser = async (req, res) => {
    try {
        const { reportedUserId, reason } = req.body;

        if (req.user.id === reportedUserId) return res.status(400).json({ msg: 'لا يمكنك التبليغ عن نفسك' });

        const user = await User.findById(reportedUserId);
        if (!user) return res.status(404).json({ msg: 'المستخدم غير موجود' });

        user.reportsCount = (user.reportsCount || 0) + 1;

        if (user.reportsCount >= 3) {
            user.trustScore = Math.max(0, user.trustScore - 40);
            if (user.reportsCount >= 6) user.isBanned = true;
        }

        await user.save();
        res.json({ msg: 'تم تقديم البلاغ بنجاح 🛡️' });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};

// 10. تعديل وحذف الأغراض
exports.updateItem = async (req, res) => {
    try {
        const item = await Item.findOneAndUpdate(
            { _id: req.params.id, donor: req.user.id, status: 'متاح' },
            { $set: req.body },
            { new: true }
        );
        if (!item) return res.status(400).json({ msg: 'لا يمكن تعديل غرض محجوز أو لست صاحبه' });
        res.json({ msg: 'تم التعديل بنجاح', item });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item || (item.donor.toString() !== req.user.id && req.user.role !== 'admin')) {
            return res.status(401).json({ msg: 'غير مصرح لك بالحذف' });
        }
        await item.deleteOne();
        res.json({ msg: 'تم الحذف بنجاح' });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
};