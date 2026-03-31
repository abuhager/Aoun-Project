const Item = require('../models/Item');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const sendEmail = require('../utils/sendEmail'); 

// 1. جلب كل التبرعات
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
        res.status(500).json({ msg: 'خطأ في السيرفر أثناء جلب الأغراض' });
    }
};

// 2. جلب أغراضي الشخصية
exports.getMyItems = async (req, res) => {
    try {
        const [user, myDonationsDocs, myRequestsDocs] = await Promise.all([
            User.findById(req.user.id).select('name email trustScore phone quota lean'),
            Item.find({ donor: req.user.id }).populate('bookedBy', 'name avatar trustScore email phone').select('+deliveryOtp').sort({ createdAt: -1 }).lean(),
            Item.find({ bookedBy: req.user.id }).populate('donor', 'name avatar trustScore email phone').select('+deliveryOtp').sort({ createdAt: -1 }).lean()
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
            .populate('donor', 'name phone trustScore avatar location isVerified')
            .populate('waitlist.user', 'name avatar');

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
        console.error("❌ الخطأ الحقيقي هون:", err.message);
        res.status(500).json({ msg: 'فشل في الإضافة، شيك على الـ Logs', error: err.message });
    }
};

// 5. حجز غرض
exports.bookItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        if (item.donor.toString() === req.user.id) {
            return res.status(400).json({ msg: 'لا يمكنك حجز غرض قمت بتبرعه بنفسك' });
        }

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
            return res.status(400).json({ msg: 'لقد استنفدت حصتك الشهرية من الحجوزات ⚠️' });
        }

        if (item.status === 'متاح') {
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            
            item.status = 'محجوز';
            item.bookedBy = req.user.id;
            item.deliveryOtp = otp; 
            
            bookerUser.quota -= 1;
            
            await Promise.all([item.save(), bookerUser.save()]);

            const donorUser = await User.findById(item.donor);

            sendEmail({
                email: bookerUser.email,
                subject: `تأكيد حجز: ${item.title} 🎁`,
                message: `<div dir="rtl">مرحباً <b>${bookerUser.name}</b>،<br><br>تم حجز الغرض بنجاح! رمز الاستلام الخاص بك هو: <h2 style="color:#006155; letter-spacing:2px;">${otp}</h2>يرجى إعطاء هذا الرمز للمتبرع عند الاستلام لضمان العملية.</div>`
            }).catch(console.error);

            sendEmail({
                email: donorUser.email,
                subject: `غرضك محجوز الآن! 🎉`,
                message: `<div dir="rtl">مرحباً <b>${donorUser.name}</b>،<br><br>قام <b>${bookerUser.name}</b> للتو بحجز غرضك (${item.title}).<br>يرجى التواصل معه لتنسيق موعد ومكان التسليم. شكراً لعطائك! 💚</div>`
            }).catch(console.error);
            
            return res.json({ msg: `تم حجز الغرض بنجاح! رمز الاستلام: ${otp} 🔐`, item });
        } 
        
        const alreadyInWaitlist = item.waitlist.some(wait => wait.user.toString() === req.user.id);
        if (alreadyInWaitlist) return res.status(400).json({ msg: 'أنت مسجل بالفعل في قائمة الانتظار' });
        if (item.bookedBy?.toString() === req.user.id) return res.status(400).json({ msg: 'أنت من يحجز هذا الغرض حالياً' });

        item.waitlist.push({ user: req.user.id });
        await item.save();

        sendEmail({
            email: bookerUser.email,
            subject: `قائمة الانتظار: ${item.title} 🕒`,
            message: `<div dir="rtl">مرحباً <b>${bookerUser.name}</b>،<br><br>تم إضافتك لقائمة الانتظار للغرض (<b>${item.title}</b>).<br>سنقوم بمراسلتك فوراً في حال قام الشخص الحالي بإلغاء حجزه وأصبح الغرض من نصيبك!</div>`
        }).catch(console.error);

        return res.json({ msg: 'الغرض محجوز حالياً، تم إضافتك لقائمة الانتظار 🕒', item, inWaitlist: true });

    } catch (err) {
        res.status(500).json({ msg: 'خطأ في السيرفر أثناء الحجز' });
    }
};

// 6. إلغاء الحجز 
exports.cancelBooking = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        const userId = req.user.id.toString(); 

        // 1️⃣ حالة: المستخدم هو الحاجز الأساسي
        if (item.bookedBy && item.bookedBy.toString() === userId) {
            console.log("✅ الحاجز الأساسي يلغي الحجز...");
            
            const [donorUser, userWhoCancelled] = await Promise.all([
                User.findById(item.donor),
                User.findById(userId)
            ]);

            if (userWhoCancelled) {
                userWhoCancelled.quota += 1;
                await userWhoCancelled.save();
            }

            if (item.waitlist && item.waitlist.length > 0) {
                const nextInLine = item.waitlist.shift(); 
                const luckyUser = await User.findById(nextInLine.user);
                
                if (luckyUser && luckyUser.quota > 0) {
                    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
                    item.bookedBy = luckyUser._id;
                    item.status = 'محجوز';
                    item.deliveryOtp = newOtp;
                    luckyUser.quota -= 1;
                    
                    await item.save();
                    await luckyUser.save();

                    // 🟢 إرسال الإيميلات للمستلم وللمتبرع بشكل منفصل
                    console.log("📨 جاري إرسال الإيميلات...");
                    
                    try {
                        await sendEmail({
                            email: luckyUser.email,
                            subject: `أخبار رائعة! الغرض أصبح لك 🎉`,
                            message: `<div dir="rtl">مرحباً <b>${luckyUser.name}</b>،<br><br>الشخص الذي كان قبلك ألغى حجزه، والغرض (<b>${item.title}</b>) أصبح لك الآن!<br>رمز الاستلام الجديد: <h2 style="color:#006155;">${newOtp}</h2>يرجى التواصل مع المتبرع لتنسيق الاستلام.</div>`
                        });
                        console.log("✅ إيميل المستلم الجديد وصل بنجاح");
                    } catch (err) {
                        console.error("❌ إيميل المستلم فشل:", err.message);
                    }

                    if (donorUser) {
                        try {
                            await sendEmail({
                                email: donorUser.email,
                                subject: `تحديث بخصوص غرضك: ${item.title} 🔄`,
                                message: `<div dir="rtl">مرحباً <b>${donorUser.name}</b>،<br><br>المستلم السابق ألغى حجزه، وتم تمرير الغرض تلقائياً للشخص التالي في الطابور: <b>${luckyUser.name}</b>.</div>`
                            });
                            console.log("✅ إيميل المتبرع وصل بنجاح");
                        } catch (err) {
                            console.error("❌ إيميل المتبرع فشل:", err.message);
                        }
                    }

                    return res.json({ msg: 'تم تمرير الغرض للشخص التالي 🔄', item });
                }
            }

            // إذا ما في حد بالانتظار
            item.bookedBy = null;
            item.status = 'متاح';
            item.deliveryOtp = undefined;
            await item.save();
            
            if (donorUser) {
                try {
                    await sendEmail({
                        email: donorUser.email,
                        subject: `غرضك متاح من جديد 📢`,
                        message: `<div dir="rtl">مرحباً <b>${donorUser.name}</b>،<br><br>تم إلغاء الحجز، وعاد غرضك (<b>${item.title}</b>) متاحاً للجميع.</div>`
                    });
                } catch (err) {
                    console.error("❌ إيميل المتبرع (عودة للمتاح) فشل:", err.message);
                }
            }
            
            return res.json({ msg: 'تم إلغاء الحجز، الغرض متاح الآن', item });
        }

        // 2️⃣ حالة: الانسحاب من قائمة الانتظار
        console.log("🔍 فحص قائمة الانتظار للانسحاب...");
        const initialLength = item.waitlist.length;
        
        item.waitlist = item.waitlist.filter(w => {
            if (!w.user) return false;
            return w.user.toString() !== userId;
        });

        if (item.waitlist.length < initialLength) {
            await item.save();
            console.log("✅ تم الانسحاب من الطابور بنجاح");
            return res.json({ msg: 'تم انسحابك من قائمة الانتظار بنجاح 🚶‍♂️', item });
        }

        return res.status(400).json({ msg: 'أنت لست الشخص الحاجز ولا في قائمة الانتظار' });

    } catch (err) {
        console.error("🔥 كراش في cancelBooking:", err.message);
        res.status(500).json({ msg: 'خطأ في السيرفر', error: err.message });
    }
};

// 7. إتمام التسليم (بالـ OTP) مع إرسال إيميلات الشكر والتقييم 🎁
// استبدل فنكشن completeDelivery بهاد الكود المصفح
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

        // 1. تحديث الداتا بيز فوراً
        item.status = 'تم التسليم';
        item.deliveryOtp = undefined; 
        await item.save();

        // 2. إرسال الرد للفرونت إند (عشان المستخدم ما يستنى)
        res.json({ msg: 'تم تسليم الغرض بنجاح! 💚', item });

        // 3. 🟢 إرسال الإيميلات بالخلفية (بدون await للرد النهائي)
        console.log("📨 بدأت عملية إرسال الإيميلات بالخلفية...");
        
        const [donorUser, receiverUser] = await Promise.all([
            User.findById(item.donor),
            User.findById(item.bookedBy)
        ]);

        if (receiverUser) {
            sendEmail({
                email: receiverUser.email,
                subject: `تم استلام الغرض بنجاح 🎁`,
                message: `<div dir="rtl">...</div>`
            }).catch(err => console.error("❌ إيميل المستلم فشل:", err.message));
        }

        if (donorUser) {
            sendEmail({
                email: donorUser.email,
                subject: `شكراً لعطائك! تم التسليم 🌟`,
                message: `<div dir="rtl">...</div>`
            }).catch(err => console.error("❌ إيميل المتبرع فشل:", err.message));
        }

    } catch (err) {
        console.error("🔥 كراش في completeDelivery:", err.message);
        if (!res.headersSent) res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};

// 8. تقييم العملية
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
        res.status(500).json({ msg: 'خطأ في السيرفر أثناء التقييم' });
    }
};

// 9. التبليغ عن مستخدم
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
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};

// 10. تعديل وحذف الأغراض
exports.updateItem = async (req, res) => {
    try {
        console.log("📦 البيانات الواصلة للتعديل (Body):", req.body);
        console.log("🖼️ هل يوجد صورة جديدة؟", req.file ? "نعم" : "لا");

        const { title, description, category, location, condition } = req.body;

        let item = await Item.findOne({ _id: req.params.id, donor: req.user.id });

        if (!item) {
            return res.status(404).json({ msg: 'الغرض غير موجود أو لست صاحبه' });
        }

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
        
        console.log("✅ تم التعديل بنجاح في الداتا بيز!");
        res.json({ msg: 'تم التعديل بنجاح ✨', item });

    } catch (err) {
        console.error("❌ خطأ التعديل في Render:", err.message);
        res.status(500).json({ msg: 'فشل التعديل بالسيرفر', error: err.message });
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
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};