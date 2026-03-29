const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail'); // تأكد من المسار حسب ملفاتك
// 1. دالة التسجيل (Register)
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // التأكد من عدم وجود المستخدم مسبقاً
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'هذا الحساب موجود مسبقاً' });

        // فحص إيميل الجامعات الأردنية والعالمية لمنح شارة طالب موثق
        const isVerifiedStudent = email.endsWith('.edu') || email.endsWith('.edu.jo');

        // تشفير الباسورد
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 🟢 توليد كود التفعيل (4 أرقام عشوائية)
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // إنشاء المستخدم
        user = new User({
            name,
            email,
            password: hashedPassword,
            isVerifiedStudent, // رح تاخذ true أو false لحالها حسب الإيميل
            isVerified: false, // 🟢 الحساب لسا مش مفعل
            verificationOtp: otp // 🟢 تخزين كود التفعيل
        });

        await user.save();

        // 🟢 تجهيز رسالة الإيميل الفخمة (HTML)
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

        // 🟢 إرسال الإيميل للطالب
        await sendEmail({
            email: user.email,
            subject: 'تفعيل حسابك في منصة عون ✉️',
            message: message
        });

        // توليد التوكن (JWT)
        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }); // التوكن صالح لـ 7 أيام

        // إرجاع النتيجة للفرونت إند مع رسالة بتطلب منه يشيك إيميله
        res.status(201).json({ 
            msg: 'تم إنشاء الحساب بنجاح، يرجى تفقد بريدك الإلكتروني لتفعيل الحساب ✉️', 
            token, 
            user: { 
                name: user.name, 
                email: user.email, 
                isVerifiedStudent: user.isVerifiedStudent, 
                role: user.role,
                isVerified: user.isVerified // نبعتها عشان الفرونت إند يعرف يوديه لصفحة التفعيل
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