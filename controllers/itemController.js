// controllers/itemController.js
const Item       = require('../models/Item');
const User       = require('../models/User');
const cloudinary = require('cloudinary').v2;
const sendEmail  = require('../utils/sendEmail');
const itemService = require('../services/itemService');
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function safeSendEmail(options) {
    try { await sendEmail(options); }
    catch (err) { console.error('📧 فشل البريد:', err.message); }
}

async function uploadToCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'aoun_items' },
            (error, result) => result ? resolve(result) : reject(error)
        );
        stream.end(buffer);
    });
}


// 1. جلب كل التبرعات مع Pagination
exports.getItems = async (req, res) => {
    try {
        const { category, location } = req.query;
        const query = { status: { $in: ['متاح', 'محجوز'] } };
        if (category) query.category = category;
        if (location) query.location = location;

        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip  = (page - 1) * limit;

        const [items, total] = await Promise.all([
            Item.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Item.countDocuments(query)
        ]);

        res.json({ items, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("Pagination Error:", err.message);
        res.status(500).json({ msg: 'خطأ في السيرفر أثناء جلب الأغراض' });
    }
};


// 2. أغراضي الشخصية
exports.getMyItems = async (req, res) => {
    try {
        const [user, donations, requests] = await Promise.all([
            User.findById(req.user.id).select('name email trustScore phone quota isVerifiedStudent').lean(),
            Item.find({ donor: req.user.id }).populate('bookedBy', 'name avatar trustScore email phone isVerifiedStudent').select('+deliveryOtp').sort({ createdAt: -1 }).lean(),
            Item.find({ bookedBy: req.user.id }).populate('donor', 'name avatar trustScore email phone isVerifiedStudent').select('+deliveryOtp').sort({ createdAt: -1 }).lean()
        ]);

        res.json({
            user,
            // ✅ [تعديل 1] إخفاء OTP من الأغراض المُسلّمة — يظهر فقط للمحجوز
            myDonations: donations.map(i => ({
                ...i,
                otp: i.status === 'محجوز' ? i.deliveryOtp : undefined
            })),
            myRequests: requests.map(i => ({
                ...i,
                otp: i.status === 'محجوز' ? i.deliveryOtp : undefined
            }))
        });
    } catch { res.status(500).json({ msg: 'خطأ في السيرفر' }); }
};


// 3. تفاصيل غرض واحد (OTP فقط للحاجز)
exports.getItemById = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id)
            .populate('donor', 'name phone trustScore avatar isVerified isVerifiedStudent')
            .select('+cancelledBy +deliveryOtp +bookedAt');

        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        const itemObj    = item.toObject();
        const authHeader = req.header('x-auth-token');
        let requesterId  = null;

        if (authHeader) {
            try {
                const jwt     = require('jsonwebtoken');
                const decoded = jwt.verify(authHeader, process.env.JWT_SECRET);
                requesterId   = decoded.user.id;
            } catch { }
        }

        if (!requesterId || itemObj.bookedBy?.toString() !== requesterId) {
            delete itemObj.deliveryOtp;
        }

        res.json(itemObj);
    } catch { res.status(500).json({ msg: 'خطأ في السيرفر' }); }
};


// 4. إضافة غرض
exports.createItem = async (req, res) => {
    try {
        const { title, description, category, location, condition } = req.body;
        let imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg', cloudinaryId = '';
        if (req.file) {
            const r = await uploadToCloudinary(req.file.buffer);
            imageUrl = r.secure_url; cloudinaryId = r.public_id;
        }
        const newItem = await new Item({
            title, description, category, location, condition,
            imageUrl, cloudinaryId, donor: req.user.id
        }).save();
        res.status(201).json({ msg: 'تم إضافة التبرع 🎁', item: newItem });
    } catch (err) { res.status(500).json({ msg: 'فشل الإضافة', error: err.message }); }
};


// 5. حجز غرض

exports.bookItem = async (req, res) => {
    try {
        // نمرر الـ ID تبع الغرض، والـ ID تبع المستخدم للـ Service
        const result = await itemService.bookItemLogic(req.params.id, req.user._id);
        
        // الرد بنجاح
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        // التقاط أي خطأ (مثلاً: الكوتا خلصت) ورده للفرونت إند
        res.status(400).json({ success: false, message: error.message });
    }
};


// 6. إلغاء الحجز أو الانسحاب من الانتظار
exports.cancelBooking = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id).select('+cancelledBy +deliveryOtp');
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        const userId   = req.user.id.toString();
        const isBooker = item.bookedBy && item.bookedBy.toString() === userId;
        const isDonor  = item.donor.toString() === userId;
        const inWait   = item.waitlist.some(w => w.user.toString() === userId);

        if (!isBooker && !isDonor && !inWait)
            return res.status(401).json({ msg: 'غير مصرح لك' });

        if (inWait && !isBooker && !isDonor) {
            await Item.findByIdAndUpdate(item._id, { $pull: { waitlist: { user: userId } } });
            return res.json({ msg: 'تم انسحابك من قائمة الانتظار بنجاح 🚶‍♂️' });
        }

        await User.findByIdAndUpdate(item.bookedBy, { $inc: { quota: 1 } });

        // ✅ [التعديل الجديد] - التعامل الذكي مع الطابور وتخطي من انتهت كوتته
        if (item.waitlist.length > 0) {
            let nextValidUser = null;
            let usersToRemove = []; 

            for (let waiting of item.waitlist) {
                nextValidUser = await User.findOneAndUpdate(
                    { _id: waiting.user, quota: { $gt: 0 } },
                    { $inc: { quota: -1 } },
                    { new: true }
                );

                if (nextValidUser) {
                    break; // وجدنا مستخدم لديه كوتا، نوقف البحث
                } else {
                    usersToRemove.push(waiting.user); // المستخدم لا يملك كوتا، نضيفه لقائمة الحذف
                }
            }

            // تنظيف الطابور من الأشخاص الذين انتهت كوتتهم
            if (usersToRemove.length > 0) {
                await Item.findByIdAndUpdate(item._id, {
                    $pull: { waitlist: { user: { $in: usersToRemove } } }
                });
            }

            // إذا وجدنا شخص مؤهل لاستلام الغرض
            if (nextValidUser) {
                const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
                await Item.findByIdAndUpdate(item._id, {
                    $set: {
                        status:      'محجوز',
                        bookedBy:    nextValidUser._id,
                        deliveryOtp: newOtp,
                        bookedAt:    new Date()
                    },
                    $addToSet: { cancelledBy: item.bookedBy },
                    $pull: { waitlist: { user: nextValidUser._id } } // سحبه من الطابور بعد حجز الغرض له
                });

                await safeSendEmail({
                    email:   nextValidUser.email,
                    subject: `الدور وصلك في "عون" 🎉`,
                    message: `<div dir="rtl">أصبح الغرض محجوزاً لك! رمز الاستلام: <b>${newOtp}</b><p>لديك 72 ساعة لإتمام الاستلام ⏱️</p></div>`
                });

                return res.json({ msg: 'تم إلغاء الحجز وتمرير الدور للشخص التالي 🔄' });
            }
        }

        // في حال كان الطابور فارغاً أو الجميع كوتتهم منتهية
        await Item.findByIdAndUpdate(item._id, {
            $set: { status: 'متاح', bookedBy: null, deliveryOtp: null, bookedAt: null },
            $addToSet: { cancelledBy: item.bookedBy }
        });
        return res.json({ msg: 'تم إلغاء الحجز والقطعة متاحة الآن ✅' });

    } catch (err) { res.status(500).json({ msg: 'خطأ في السيرفر' }); }
};


// 7. إتمام التسليم
exports.completeDelivery = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id).select('+deliveryOtp');
        if (!item || item.donor.toString() !== req.user.id)
            return res.status(401).json({ msg: 'غير مصرح لك' });
        if (String(item.deliveryOtp).trim() !== String(req.body.otp).trim())
            return res.status(400).json({ msg: 'الرمز خطأ ❌' });

        item.status      = 'تم التسليم';
        item.deliveryOtp = undefined;
        item.bookedAt    = undefined;
        await item.save();
        res.json({ msg: 'تم التسليم! 💚', item });

        const receiver = await User.findById(item.bookedBy);
        if (receiver) await safeSendEmail({
            email:   receiver.email,
            subject: `تم استلام الغرض 🎁`,
            message: `<div dir="rtl">لا تنسَ تقييم المتبرع 💚</div>`
        });
    } catch { res.status(500).json({ msg: 'خطأ في التسليم' }); }
};


// 8. التقييم
exports.rateItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item || item.bookedBy.toString() !== req.user.id)
            return res.status(401).json({ msg: 'غير مصرح لك' });
        if (item.status !== 'تم التسليم' || item.isRated)
            return res.status(400).json({ msg: 'لا يمكن التقييم الآن' });

        const donor  = await User.findById(item.donor);
        const points = req.body.rating >= 5 ? 5 : req.body.rating >= 3 ? 2 : -5;
        donor.trustScore = Math.min(100, Math.max(0, (donor.trustScore || 85) + points));
        item.isRated = true;
        await Promise.all([item.save(), donor.save()]);
        res.json({ msg: 'تم التقييم 🌟', trustScore: donor.trustScore });
    } catch { res.status(500).json({ msg: 'خطأ في التقييم' }); }
};


// 9. التبليغ عن مستخدم
exports.reportUser = async (req, res) => {
    try {
        const { reportedUserId } = req.body;
        const reporterId = req.user.id.toString();
        if (reporterId === reportedUserId)
            return res.status(400).json({ msg: 'لا يمكنك التبليغ عن نفسك' });

        const user = await User.findById(reportedUserId);
        if (!user) return res.status(404).json({ msg: 'المستخدم غير موجود' });
        if ((user.reportedBy || []).some(id => id.toString() === reporterId))
            return res.status(400).json({ msg: 'بلّغت مسبقاً 🚫' });

        user.reportedBy.push(reporterId);
        const total = user.reportedBy.length;

        if (total >= 6) {
            // ✅ [تعديل 3] لو محظور مسبقاً أو وصل الحد → لا خصم إضافي
            user.isBanned = true;
        } else if (total >= 2) {
            user.trustScore = Math.max(0, (user.trustScore || 85) - total * 5);
        }
        // لو total < 2 → لا خصم ولا حظر

        await user.save();
        res.json({ msg: 'تم البلاغ 🛡️' });
    } catch { res.status(500).json({ msg: 'خطأ في البلاغ' }); }
};


// 10. تعديل غرض
exports.updateItem = async (req, res) => {
    try {
        const item = await Item.findOne({ _id: req.params.id, donor: req.user.id });
        if (!item) return res.status(404).json({ msg: 'الغرض غير موجود' });

        if (req.file) {
            if (item.cloudinaryId) await cloudinary.uploader.destroy(item.cloudinaryId).catch(console.error);
            const r = await uploadToCloudinary(req.file.buffer);
            item.imageUrl = r.secure_url; item.cloudinaryId = r.public_id;
        }

        const { title, description, category, location, condition } = req.body;
        if (title)       item.title       = title;
        if (description) item.description = description;
        if (category)    item.category    = category;
        if (location)    item.location    = location;
        if (condition)   item.condition   = condition;

        await item.save();
        res.json({ msg: 'تم التعديل ✨', item });
    } catch { res.status(500).json({ msg: 'فشل التعديل' }); }
};


// 11. حذف غرض
exports.deleteItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item || (item.donor.toString() !== req.user.id && req.user.role !== 'admin'))
            return res.status(401).json({ msg: 'غير مصرح لك' });

        if (item.cloudinaryId)
            await cloudinary.uploader.destroy(item.cloudinaryId).catch(console.error);

        if (item.status === 'محجوز' && item.bookedBy) {
            const [receiver] = await Promise.all([
                User.findByIdAndUpdate(item.bookedBy, { $inc: { quota: 1 } }, { new: true }),
                User.findByIdAndUpdate(item.donor, { $inc: { trustScore: -3 } })
            ]);
            if (receiver) await safeSendEmail({
                email:   receiver.email,
                subject: `تحديث حجزك ⚠️`,
                message: `<div dir="rtl">تم حذف الغرض (<b>${item.title}</b>) واسترداد حصتك 💚</div>`
            });
        }

        await item.deleteOne();
        res.json({ msg: 'تم الحذف ⚖️' });
    } catch { res.status(500).json({ msg: 'خطأ في الحذف' }); }
};