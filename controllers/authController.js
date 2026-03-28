const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

        // إنشاء المستخدم
        user = new User({
            name,
            email,
            password: hashedPassword,
            isVerifiedStudent // رح تاخذ true أو false لحالها حسب الإيميل
        });

        await user.save();

        // توليد التوكن (JWT)
        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }); // التوكن صالح لـ 7 أيام

        res.status(201).json({ 
            msg: 'تم إنشاء الحساب بنجاح', 
            token, 
            user: { name: user.name, email: user.email, isVerifiedStudent: user.isVerifiedStudent, role: user.role } 
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر');
    }
};

// 2. دالة تسجيل الدخول (Login)
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // البحث عن المستخدم
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'بيانات الدخول غير صحيحة' });

        // مطابقة الباسورد
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'بيانات الدخول غير صحيحة' });

        // توليد التوكن (JWT)
        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({ 
            msg: 'تم تسجيل الدخول بنجاح',
            token, 
            user: { name: user.name, email: user.email, isVerifiedStudent: user.isVerifiedStudent, role: user.role } 
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('خطأ في السيرفر');
    }
};