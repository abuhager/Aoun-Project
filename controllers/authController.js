const User = require('../models/User');
const bcrypt = require('bcryptjs');

// دالة تسجيل مستخدم جديد
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. التأكد إذا المستخدم موجود أصلاً
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'هذا الحساب موجود مسبقاً' });
        }

        // 2. منطق عون: فحص إذا كان طالب (Email ends with .edu or .edu.jo)
        const isStudent = email.endsWith('.edu') || email.endsWith('.edu.jo');

        // 3. تشفير كلمة المرور
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. إنشاء المستخدم الجديد
        user = new User({
            name,
            email,
            password: hashedPassword,
            role: isStudent ? 'user' : 'user', // يمكن مستقبلاً تمييزهم بصلاحيات
            // ملاحظة: سنضيف حقل isVerifiedStudent للموديل لاحقاً إذا أردت تفعيله بدقة
        });

        await user.save();
        res.status(201).json({ 
            msg: 'تم إنشاء الحساب بنجاح',
            isStudent: isStudent ? 'تم توثيقك كطالب تلقائياً 🎓' : 'حساب عادي'
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر');
    }
};