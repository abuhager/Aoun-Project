const User = require('../models/User');
const Item = require('../models/Item');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // للتعامل مع التوكنات الخاصة بإعادة تعيين كلمة المرور
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail'); // تأكد من المسار حسب ملفاتك
// 1. دالة التسجيل (Register)
exports.register = async (req, res) => {
    try {
const { name, email, password, phone } = req.body;
        // 1. التأكد من وجود المستخدم مسبقاً
        let user = await User.findOne({ email });

        if (user) {
            // الحالة الذكية: إذا الحساب موجود بس مش مفعل
            if (!user.isVerified) {
                // توليد كود تفعيل جديد
                const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
                user.verificationOtp = newOtp;
                
                // تحديث الاسم والباسورد في حال قرر يغيرهم وهو لسا ما فعل
                const hashedPassword = await bcrypt.hash(password, 10);
                user.name = name;

                await user.save();

                // إرسال إيميل بالكود الجديد (استخدام نفس القالب الفخم)
                const resendMessage = `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; direction: rtl;">
                        <h2 style="color: #006155;">أهلاً بك مجدداً في عون يا ${name}! 🎓</h2>
                        <p style="font-size: 16px; color: #333;">يبدو أنك حاولت التسجيل مسبقاً ولم تفعل الحساب. إليك كود التفعيل الجديد:</p>
                        <div style="background-color: #f3f4f5; padding: 20px; border-radius: 10px; display: inline-block; margin: 20px 0;">
                            <h1 style="color: #087c6e; font-size: 40px; margin: 0; letter-spacing: 10px;">${newOtp}</h1>
                        </div>
                        <p style="font-size: 14px; color: #777;">أدخل هذا الكود لتتمكن من استخدام حسابك.</p>
                    </div>
                `;

                await sendEmail({
                    email: user.email,
                    subject: 'تفعيل حسابك في منصة عون ✉️',
                    message: resendMessage
                });

                return res.status(200).json({ 
                    msg: 'هذا الحساب موجود مسبقاً ولكنه غير مفعل، تم إرسال كود جديد لإيميلك ✉️',
                    needsVerification: true,
                    email: user.email 
                });
            }

            // إذا الحساب موجود ومفعل فعلاً
            return res.status(400).json({ msg: 'هذا الحساب موجود مسبقاً ومفعل بالفعل، يمكنك تسجيل الدخول.' });
        }

        // 2. إنشاء مستخدم جديد (في حال لم يكن الإيميل موجوداً أصلاً)
        const isVerifiedStudent = email.endsWith('.edu') || email.endsWith('.edu.jo');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        user = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            isVerifiedStudent,
            isVerified: false,
            verificationOtp: otp
        });

        await user.save();

        const message = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; direction: rtl;">
                <h2 style="color: #006155;">مرحباً بك في مجتمع عون يا ${name}! 🎓</h2>
                <p style="font-size: 16px; color: #333;">شكراً لانضمامك إلينا. لتفعيل حسابك، يرجى استخدام رمز التحقق التالي:</p>
                <div style="background-color: #f3f4f5; padding: 20px; border-radius: 10px; display: inline-block; margin: 20px 0;">
                    <h1 style="color: #087c6e; font-size: 40px; margin: 0; letter-spacing: 10px;">${otp}</h1>
                </div>
                <p style="font-size: 14px; color: #777;">إذا لم تقم بإنشاء هذا الحساب، يرجى تجاهل هذه الرسالة.</p>
            </div>
        `;

        await sendEmail({
            email: user.email,
            subject: 'تفعيل حسابك في منصة عون ✉️',
            message: message
        });

        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ 
            msg: 'تم إنشاء الحساب بنجاح، يرجى تفقد بريدك الإلكتروني لتفعيل الحساب ✉️', 
            token, 
            user: { 
                name: user.name, 
                email: user.email, 
                isVerifiedStudent: user.isVerifiedStudent, 
                role: user.role,
                isVerified: user.isVerified
            } 
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر');
    }
};
// دالة تأكيد البريد الإلكتروني (OTP)
exports.verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;

        // 1. ندور على المستخدم
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ msg: 'المستخدم غير موجود 🛑' });
        }

        // 2. هل الحساب مفعل أصلاً؟
        if (user.isVerified) {
            return res.status(400).json({ msg: 'هذا الحساب مفعل مسبقاً، يمكنك تسجيل الدخول مباشرة ✅' });
        }

        // 3. مقارنة الكود (OTP)
        if (user.verificationOtp !== otp) {
            return res.status(400).json({ msg: 'رمز التحقق غير صحيح ❌' });
        }

        // 4. مبروك! الكود صحيح، بنفعل الحساب وبنمسح الكود للأمان
        user.isVerified = true;
        user.verificationOtp = undefined;
        await user.save();

        res.status(200).json({ msg: 'تم تفعيل حسابك بنجاح! يمكنك الآن تسجيل الدخول 🎉' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر أثناء تفعيل الحساب');
    }
};
// 2. دالة تسجيل الدخول (Login)
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // البحث عن المستخدم
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'البريد الإلكتروني غير صحيح' });
    if (user.isBanned) {
    return res.status(403).json({ msg: 'هذا الحساب محظور بسبب مخالفة معايير مجتمع عون 🛑' });
    }
        // مطابقة الباسورد
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'كلمة الدخول غير صحيحة' });

        // 🟢 الإضافة الجديدة: منع الدخول إذا الحساب غير مفعل
        if (!user.isVerified) {
            return res.status(403).json({ 
                msg: 'حسابك غير مفعل! يرجى تفعيل حسابك باستخدام الرمز (OTP) المرسل إلى بريدك الإلكتروني ✉️',
                needsVerification: true, // هاي الإشارة رح نستخدمها بالفرونت إند عشان نحوله لصفحة التفعيل
                email: user.email // بعثنا الإيميل عشان الفرونت إند يظل متذكره
            });
        }

        // توليد التوكن (JWT)
        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({ 
            msg: 'تم تسجيل الدخول بنجاح',
            token, 
            user: { 
                name: user.name, 
                email: user.email, 
                isVerifiedStudent: user.isVerifiedStudent, 
                role: user.role,
                isVerified: user.isVerified // ضفناها هون للاحتياط
            } 
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر');
    }
};
exports.getUserProfile = async (req, res) => {
   try {
        // تشغيل كل الاستعلامات بالتوازي (Concurrent)
        const [user, allDonations, completedRequests, totalRatings] = await Promise.all([
            User.findById(req.params.id).select('-password -__v'),
            Item.find({ donor: req.params.id }).populate('bookedBy', 'name avatar').sort({ createdAt: -1 }),
            Item.find({ bookedBy: req.params.id, status: 'تم التسليم' }).populate('donor', 'name avatar').sort({ createdAt: -1 }),
            Item.countDocuments({ donor: req.params.id, isRated: true })
        ]);

        if (!user) return res.status(404).json({ msg: 'المستخدم غير موجود' });

        const stats = {
            donationsCount: allDonations.length,
            completedDonations: allDonations.filter(i => i.status === 'تم التسليم').length,
            receivedCount: completedRequests.length,
            totalRatings
        };

        res.json({ user, stats, allDonations, completedRequests });
    } catch (err) {
        console.error(err);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'المستخدم غير موجود' });
        res.status(500).send('خطأ في السيرفر');
    }
};
// 1️⃣ طلب رابط استرجاع كلمة المرور (نسيت كلمة المرور)
exports.forgotPassword = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(404).json({ msg: 'لا يوجد حساب مسجل بهذا الإيميل' });
        }

        // توليد رمز عشوائي آمن
        const resetToken = crypto.randomBytes(20).toString('hex');

        // تشفير الرمز وتخزينه بالداتا بيس (للحماية)
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // الرمز صالح لمدة 15 دقيقة فقط

        await user.save();

        // إنشاء الرابط اللي رح يكبس عليه اليوزر (رابط الفرونت إند)
        // 🟢 تأكد إن البورت تبع الفرونت إند 3000
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
const resetUrl = `${clientUrl}/reset-password/${resetToken}`;
        const message = `
            <div dir="rtl">
                <h2>طلب استعادة كلمة المرور</h2>
                <p>لقد طلبت استعادة كلمة المرور لحسابك في منصة عون.</p>
                <p>يرجى النقر على الرابط أدناه لتعيين كلمة مرور جديدة (هذا الرابط صالح لمدة 15 دقيقة فقط):</p>
                <a href="${resetUrl}" style="background-color: #006155; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">إعادة تعيين كلمة المرور</a>
                <p style="margin-top: 20px; font-size: 12px; color: gray;">إذا لم تقم بهذا الطلب، يرجى تجاهل هذا البريد.</p>
            </div>
        `;

        try {
            await sendEmail({
                email: user.email,
                subject: 'استعادة كلمة المرور - منصة عون 🔒',
                message: message
            });

            res.status(200).json({ msg: 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني' });
        } catch (err) {
            // لو فشل الإيميل، بنظف الداتا بيس
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();
            return res.status(500).json({ msg: 'حدث خطأ أثناء إرسال البريد الإلكتروني' });
        }
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};

// 2️⃣ تعيين كلمة المرور الجديدة بعد الضغط على الرابط
exports.resetPassword = async (req, res) => {
    try {
        // تشفير الرمز اللي إجى من الرابط عشان نقارنه باللي تخزن بالداتا بيس
        const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        // 🟢 ضفنا .select('+password') عشان نجيب الباسوورد القديم من الداتا بيس ونقارنه
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() } // التأكد إن الرمز لسا ما انتهى وقته
        }).select('+password'); 

        if (!user) {
            return res.status(400).json({ msg: 'الرابط غير صالح أو انتهت صلاحيته ❌' });
        }

        // 🟢 اللمسة الأمنية (Security Check): نتأكد إن الباسوورد الجديد مش نفس القديم
        const isSamePassword = await bcrypt.compare(req.body.password, user.password);
        if (isSamePassword) {
            return res.status(400).json({ msg: 'يرجى اختيار كلمة مرور جديدة تختلف عن الحالية ❌' });
        }

        // تشفير كلمة المرور الجديدة
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);

        // تنظيف حقول الاسترجاع لأننا خلصنا منها
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        res.status(200).json({ msg: 'تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول ✅' });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
};