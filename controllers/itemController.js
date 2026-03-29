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
        // ضفنا phone لبيانات اليوزر نفسه للاحتياط
        const user = await User.findById(req.user.id).select('name email trustScore phone'); 
        
        // 🟢 التعديل: ضفنا phone هون عشان المتبرع يقدر يحكي مع المستلم
        const myDonations = await Item.find({ donor: req.user.id })
            .populate('bookedBy', 'name avatar trustScore email phone') 
            .sort({ createdAt: -1 });

        // 🟢 وهون موجود أصلاً (عشان المستلم يحكي مع المتبرع)
        const myRequests = await Item.find({ bookedBy: req.user.id })
            .populate('donor', 'name avatar trustScore email phone')
            .sort({ createdAt: -1 });

        res.json({ user, myDonations, myRequests });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر');
    }
};
// 3. جلب غرض واحد بالتفصيل
exports.getItemById = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id)
            .populate('donor', 'name phone trustScore avatar location isVerified');

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

        // 3. مقارنة الـ OTP
        const savedOtp = String(item.deliveryOtp).trim();
        const enteredOtp = String(otp).trim();

        if (savedOtp !== enteredOtp) {
            return res.status(400).json({ msg: 'الرمز الذي أدخلته غير صحيح ❌' });
        }

        // 4. التعديل الجوهري: 
        // بنغير الحالة لـ "تم التسليم" وبنحذف الـ OTP فقط
        // **مهم جداً**: ما بنلمس الـ bookedBy عشان يضل مسجل مين اللي استلم القطعة
        item.status = 'تم التسليم';
        item.deliveryOtp = undefined; 
        
        await item.save();

        // 5. نرجع البيانات كاملة عشان الفرونت إند يحدّث الواجهة فوراً
        res.json({ 
            msg: 'تم تسليم الغرض بنجاح! شكراً لعطائك 💚', 
            item 
        });
        
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
exports.rateItem = async (req, res) => {
    try {
        const { rating } = req.body; // التقييم من 1 لـ 5
        const item = await Item.findById(req.params.id);

        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });
        
        // التأكد إن اللي بقيم هو المستلم (bookedBy)
        if (item.bookedBy.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'فقط المستلم يمكنه تقييم هذه العملية' });
        }

        if (item.status !== 'تم التسليم') {
            return res.status(400).json({ msg: 'لا يمكنك التقييم قبل إتمام التسليم' });
        }

        if (item.isRated) {
            return res.status(400).json({ msg: 'لقد قمت بتقييم هذا الغرض مسبقاً' });
        }

        // تحديث نقاط الثقة للمتبرع (Donor)
        const donor = await User.findById(item.donor);
        
        // حسبة بسيطة: 5 نجوم (+5 نقاط)، 1-2 نجمة (-5 نقاط)، 3-4 (نقطتين)
        let points = 0;
        if (rating >= 5) points = 5;
        else if (rating >= 3) points = 2;
        else points = -5;

        donor.trustScore = Math.min(100, Math.max(0, (donor.trustScore || 85) + points));
        await donor.save();

        // مارك الغرض كـ مقيم
        item.isRated = true;
        await item.save();

        res.json({ msg: 'شكراً لتقييمك! تم تحديث نقاط الثقة للمتبرع 🌟', trustScore: donor.trustScore });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر أثناء التقييم');
    }
};
exports.reportUser = async (req, res) => {
    try {
        const { reportedUserId, reason } = req.body;

        // 1. منع المستخدم من التبليغ عن نفسه
        if (req.user.id === reportedUserId) {
            return res.status(400).json({ msg: 'لا يمكنك التبليغ عن نفسك! 🤔' });
        }

        const user = await User.findById(reportedUserId);
        if (!user) return res.status(404).json({ msg: 'المستخدم غير موجود' });

        // 2. زيادة عدد البلاغات
        user.reportsCount = (user.reportsCount || 0) + 1;

        // 3. عقوبة تصاعدية
        if (user.reportsCount >= 3) {
            user.trustScore = Math.max(0, user.trustScore - 50); // خصم نص النقاط
            
            // 🛑 إذا زادت البلاغات عن 5 مثلاً، بنعمل حظر تلقائي (اختياري)
            if (user.reportsCount >= 5) {
                user.isBanned = true;
            }
        }

        await user.save();
        res.json({ 
            msg: 'تم تقديم البلاغ بنجاح، فريق عون سيراجع الحالة لضمان أمان المجتمع 🛡️',
            reportsCount: user.reportsCount 
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر أثناء تقديم البلاغ');
    }
};