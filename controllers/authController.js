const User = require('../models/User');
const Item = require('../models/Item');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail'); // تأكد من المسار حسب ملفاتك
// 1. دالة التسجيل (Register)
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. التأكد من وجود المستخدم مسبقاً
        let user = await User.findOne({ email });

        if (user) {
            // الحالة الذكية: إذا الحساب موجود بس مش مفعل
            if (!user.isVerified) {
                // توليد كود تفعيل جديد
                const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
                user.verificationOtp = newOtp;
                
                // تحديث الاسم والباسورد في حال قرر يغيرهم وهو لسا ما فعل
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(password, salt);
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
        const user = await User.findById(req.params.id).select('-password -__v');
        if (!user) return res.status(404).json({ msg: 'المستخدم غير موجود' });

        // 1. كل التبرعات اللي قدمها هاد الشخص (متاح + محجوز + تم التسليم)
        const allDonations = await Item.find({ donor: req.params.id })
            .sort({ createdAt: -1 });

        // 2. كل الطلبات اللي هو استلمها فعلياً (عشان نبين إنه مستخدم فعال)
        const completedRequests = await Item.find({ 
            bookedBy: req.params.id, 
            status: 'تم التسليم' 
        }).sort({ createdAt: -1 });

        // 3. إحصائيات سريعة
        const stats = {
            donationsCount: allDonations.length,
            completedDonations: allDonations.filter(i => i.status === 'تم التسليم').length,
            receivedCount: completedRequests.length
        };

        res.json({
            user,
            stats,
            allDonations,
            completedRequests
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
};