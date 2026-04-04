const Item = require('../models/Item');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;
const sendEmail = require('../utils/sendEmail'); 

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 1. جلب كل التبرعات
exports.getItems = async (req, res) => {
    try {
        const { category, location } = req.query;
        let query = { status: { $in: ['متاح', 'محجوز'] } }; 

        if (category) query.category = category;
        if (location) query.location = location;

        const items = await Item.find(query)
            .sort({ createdAt: -1 })
            .lean();

        res.json(items);
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في السيرفر أثناء جلب الأغراض' });
    }
};

// 2. جلب أغراضي الشخصية
exports.getMyItems = async (req, res) => {
    try {
        const [user, myDonationsDocs, myRequestsDocs] = await Promise.all([
            User.findById(req.user.id).select('name email trustScore phone quota isVerifiedStudent').lean(),
            Item.find({ donor: req.user.id }).populate('bookedBy', 'name avatar trustScore email phone isVerifiedStudent').select('+deliveryOtp').sort({ createdAt: -1 }).lean(),
            Item.find({ bookedBy: req.user.id }).populate('donor', 'name avatar trustScore email phone isVerifiedStudent').select('+deliveryOtp').sort({ createdAt: -1 }).lean()
        ]);

        const myDonations = myDonationsDocs.map(item => ({ ...item, otp: item.deliveryOtp }));
        const myRequests = myRequestsDocs.map(item => ({ ...item, otp: item.deliveryOtp }));

        res.json({ user, myDonations, myRequests });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};

// 3. جلب غرض واحد بالتفصيل
exports.getItemById = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id)
            .populate('donor', 'name phone trustScore avatar isVerified isVerifiedStudent');

        if (!item) return res.status(404).json({ msg: 'هذا الغرض غير موجود' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};

// 4. إضافة غرض جديد
exports.createItem = async (req, res) => {
    try {
        const { title, description, category, location, condition } = req.body;
        let imageUrl = '';

        if (req.file) {
            const uploadPromise = new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'aoun_items' },
                    (error, result) => {
                        if (result) resolve(result.secure_url);
                        else reject(error);
                    }
                );
                stream.end(req.file.buffer); 
            });
            imageUrl = await uploadPromise;
        }

        const newItem = new Item({
            title, description, category, location, condition, 
            imageUrl: imageUrl || 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
            donor: req.user.id 
        });

        await newItem.save();
        res.status(201).json({ msg: 'تم إضافة التبرع بنجاح 🎁', item: newItem });
    } catch (err) {
        console.error("❌ خطأ الإضافة:", err.message);
        res.status(500).json({ msg: 'فشل في الإضافة', error: err.message });
    }
};

// 5. حجز غرض (نظام الكوتا 2)
exports.bookItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        if (item.donor.toString() === req.user.id) {
            return res.status(400).json({ msg: 'لا يمكنك حجز غرض قمت بتبرعه بنفسك' });
        }

        // إجبار المستخدم على التقييم قبل الحجز الجديد
        const unratedItem = await Item.findOne({
            bookedBy: req.user.id,
            status: 'تم التسليم',
            isRated: false
        });

        if (unratedItem) {
            return res.status(400).json({ 
                msg: `العطاء بيكمل بكلمة شكر! 💚 الرجاء تقييم المتبرع للغرض (${unratedItem.title}) قبل حجز أغراض جديدة.` 
            });
        }

        const bookerUser = await User.findById(req.user.id);

        if (bookerUser.quota <= 0) {
            return res.status(400).json({ msg: 'لقد استنفدت حصتك من الحجوزات (الكوتا حالياً 0) ⚠️' });
        }

        if (item.status === 'متاح') {
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            
            item.status = 'محجوز';
            item.bookedBy = req.user.id;
            item.deliveryOtp = otp; 
            
            // خصم 1 من الكوتا (بناءً على نظامك الجديد: الكوتا 2)
            bookerUser.quota -= 1;
            
            await Promise.all([item.save(), bookerUser.save()]);

            const donorUser = await User.findById(item.donor);

            sendEmail({
                email: bookerUser.email,
                subject: `تأكيد حجز: ${item.title} 🎁`,
                message: `<div dir="rtl">تم حجز الغرض بنجاح! رمز الاستلام الخاص بك هو: <h2 style="color:#006155;">${otp}</h2>يرجى إعطاؤه للمتبرع عند الاستلام.</div>`
            }).catch(console.error);

            sendEmail({
                email: donorUser.email,
                subject: `غرضك محجوز الآن! 🎉`,
                message: `<div dir="rtl">قام <b>${bookerUser.name}</b> بحجز غرضك (${item.title}). يرجى التنسيق معه للاستلام.</div>`
            }).catch(console.error);
            
            return res.json({ msg: `تم حجز الغرض بنجاح! رمز الاستلام: ${otp} 🔐`, item });
        } 
        
        // قائمة الانتظار
        const alreadyInWaitlist = item.waitlist.some(wait => wait.user.toString() === req.user.id);
        if (alreadyInWaitlist) return res.status(400).json({ msg: 'أنت مسجل بالفعل في قائمة الانتظار' });
        if (item.bookedBy?.toString() === req.user.id) return res.status(400).json({ msg: 'أنت من يحجز هذا الغرض حالياً' });

        item.waitlist.push({ user: req.user.id });
        await item.save();

        return res.json({ msg: 'الغرض محجوز حالياً، تم إضافتك لقائمة الانتظار 🕒', item, inWaitlist: true });

    } catch (err) {
        res.status(500).json({ msg: 'خطأ في السيرفر أثناء الحجز' });
    }
};

// 6. إلغاء الحجز (مع إعادة الكوتا وتمرير الدور)
exports.cancelBooking = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        const userId = req.user.id.toString(); 

        if (item.bookedBy && item.bookedBy.toString() === userId) {
            const [donorUser, userWhoCancelled] = await Promise.all([
                User.findById(item.donor),
                User.findById(userId)
            ]);

            // إعادة الكوتا للمستخدم لأنه ألغى بنفسه (تشجيع على الشفافية)
            if (userWhoCancelled) {
                userWhoCancelled.quota += 1;
                await userWhoCancelled.save();
            }

            // إذا كان هناك قائمة انتظار، نمرر الدور فوراً
            if (item.waitlist && item.waitlist.length > 0) {
                const nextInLine = item.waitlist.shift(); 
                const luckyUser = await User.findById(nextInLine.user);
                
                if (luckyUser && luckyUser.quota > 0) {
                    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
                    item.bookedBy = luckyUser._id;
                    item.status = 'محجوز';
                    item.deliveryOtp = newOtp;
                    luckyUser.quota -= 1; // خصم الكوتا من المستلم الجديد
                    
                    // تحديث تاريخ التعديل لضمان بدء عداد الـ 48 ساعة من الآن
                    item.markModified('status'); 
                    
                    await item.save();
                    await luckyUser.save();

                    // إرسال الإيميلات للمستلم الجديد والمتبرع
                    sendEmail({
                        email: luckyUser.email,
                        subject: `أخبار رائعة! الغرض أصبح لك 🎉`,
                        message: `<div dir="rtl">الغرض (<b>${item.title}</b>) أصبح من نصيبك! رمز الاستلام: <h2 style="color:#006155;">${newOtp}</h2></div>`
                    }).catch(console.error);

                    return res.json({ msg: 'تم إلغاء حجزك وتمرير الغرض للشخص التالي في الانتظار 🔄', item });
                }
            }

            // إذا لم يكن هناك قائمة انتظار، يعود الغرض متاحاً
            item.bookedBy = null;
            item.status = 'متاح';
            item.deliveryOtp = undefined;
            await item.save();
            
            return res.json({ msg: 'تم إلغاء الحجز بنجاح، الغرض متاح الآن', item });
        }

        // الانسحاب من قائمة الانتظار
        const initialLength = item.waitlist.length;
        item.waitlist = item.waitlist.filter(w => w.user && w.user.toString() !== userId);

        if (item.waitlist.length < initialLength) {
            await item.save();
            return res.json({ msg: 'تم انسحابك من قائمة الانتظار بنجاح 🚶‍♂️', item });
        }

        return res.status(400).json({ msg: 'لا يوجد حجز فعال لتلغيه' });

    } catch (err) {
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};

// 7. إتمام التسليم
exports.completeDelivery = async (req, res) => {
    try {
        const { otp } = req.body; 
        const item = await Item.findById(req.params.id);
        
        if (!item || item.donor.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'غير مصرح لك' });
        }

        if (String(item.deliveryOtp).trim() !== String(otp).trim()) {
            return res.status(400).json({ msg: 'الرمز غير صحيح ❌' });
        }

        item.status = 'تم التسليم';
        item.deliveryOtp = undefined; 
        await item.save();

        res.json({ msg: 'تم تسليم الغرض بنجاح! 💚', item });

        // إرسال إيميلات الشكر
        const [donorUser, receiverUser] = await Promise.all([
            User.findById(item.donor),
            User.findById(item.bookedBy)
        ]);

        if (receiverUser) {
            sendEmail({
                email: receiverUser.email,
                subject: `تم استلام الغرض بنجاح 🎁`,
                message: `<div dir="rtl">شكراً لاستخدامك عون، لا تنسَ تقييم المتبرع بكلمة شكر 💚</div>`
            }).catch(err => console.error(err.message));
        }

    } catch (err) {
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};

// 8. التقييم
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

        res.json({ msg: 'تم التقييم بنجاح 🌟', trustScore: donor.trustScore });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};

// 9. التبليغ عن مستخدم (نظام العقوبات والإشعارات المتدرج 🛡️)
exports.reportUser = async (req, res) => {
    try {
        const { reportedUserId, reason } = req.body;
        const reporterId = req.user.id; 

        if (reporterId === reportedUserId) {
            return res.status(400).json({ msg: 'لا يمكنك التبليغ عن نفسك' });
        }

        const user = await User.findById(reportedUserId);
        if (!user) return res.status(404).json({ msg: 'المستخدم غير موجود' });

        if (!user.reportedBy) user.reportedBy = [];

        if (user.reportedBy.includes(reporterId)) {
            return res.status(400).json({ msg: 'لقد قمت بتقديم بلاغ ضد هذا المستخدم مسبقاً 🚫' });
        }

        user.reportedBy.push(reporterId);
        const totalReports = user.reportedBy.length; 

        let pointsToDeduct = 0;

        // نظام العقوبات
        if (totalReports >= 6) {
            user.isBanned = true;
        } else if (totalReports >= 2) {
            pointsToDeduct = totalReports * 5; // خصم متصاعد
            user.trustScore = Math.max(0, (user.trustScore || 85) - pointsToDeduct);
        }

        await user.save();

        // 🟢 الإضافة الجديدة: إرسال إيميل تحذيري للمستخدم المُبلَّغ عنه
        try {
            let emailSubject = '';
            let emailMessage = '';

            if (user.isBanned) {
                emailSubject = 'إشعار حظر الحساب - منصة عون 🛑';
                emailMessage = `<div dir="rtl">مرحباً <b>${user.name}</b>،<br><br>نؤسفنا إبلاغك بأنه تم حظر حسابك في منصة عون بسبب تلقي عدد كبير من البلاغات (6 بلاغات) ومخالفة معايير المجتمع.<br>إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع الدعم الفني.</div>`;
            } else if (totalReports === 1) {
                emailSubject = 'تنبيه: تلقينا بلاغاً بشأن حسابك ⚠️';
                emailMessage = `<div dir="rtl">مرحباً <b>${user.name}</b>،<br><br>نود إعلامك بأننا تلقينا بلاغاً من أحد المستخدمين بشأن تجربته معك.<br>هذا مجرد تنبيه أولي، ولكن نرجو منك الالتزام بمعايير الثقة في منصة عون لتجنب خصم نقاط الثقة من حسابك.</div>`;
            } else {
                emailSubject = 'تحذير هام: انخفاض نقاط الثقة 📉';
                emailMessage = `<div dir="rtl">مرحباً <b>${user.name}</b>،<br><br>تلقينا بلاغاً جديداً بشأن حسابك (إجمالي البلاغات: ${totalReports}).<br>بناءً على سياسة المنصة، تم خصم نقاط من "مؤشر الثقة" الخاص بك. انخفاض مؤشر الثقة قد يؤثر على فرصك في حجز الأغراض مستقبلاً، واستمرار البلاغات سيؤدي إلى حظر الحساب.</div>`;
            }

            await sendEmail({
                email: user.email,
                subject: emailSubject,
                message: emailMessage
            });
            console.log(`📨 تم إرسال إيميل تحذير للمستخدم: ${user.email}`);
        } catch (emailErr) {
            console.error("❌ فشل إرسال إيميل التحذير:", emailErr.message);
        }

        res.json({ msg: 'تم تقديم البلاغ بنجاح، شكراً لمساعدتنا في الحفاظ على مجتمع "عون" 🛡️' });

    } catch (err) {
        console.error("❌ خطأ في فنكشن التبليغ:", err.message);
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};
// 10. التعديل والحذف
exports.updateItem = async (req, res) => {
    try {
        const { title, description, category, location, condition } = req.body;
        let item = await Item.findOne({ _id: req.params.id, donor: req.user.id });

        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        if (req.file) {
            const uploadPromise = new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'aoun_items' },
                    (error, result) => {
                        if (result) resolve(result.secure_url);
                        else reject(error);
                    }
                );
                stream.end(req.file.buffer);
            });
            item.imageUrl = await uploadPromise;
        }

        if (title) item.title = title;
        if (description) item.description = description;
        if (category) item.category = category;
        if (location) item.location = location;
        if (condition) item.condition = condition;

        await item.save();
        res.json({ msg: 'تم التعديل بنجاح ✨', item });
    } catch (err) {
        res.status(500).json({ msg: 'فشل التعديل' });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item || (item.donor.toString() !== req.user.id && req.user.role !== 'admin')) {
            return res.status(401).json({ msg: 'غير مصرح لك' });
        }
        await item.deleteOne();
        res.json({ msg: 'تم الحذف بنجاح' });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};