const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const sendEmail       = require('../utils/sendEmail');
const userRepository  = require('../repositories/userRepository');
const Item            = require('../models/Item');

// ─ 6 أرقام (100000–999999)
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─ JWT
const generateToken = (user) => {
    const payload = { user: { id: user.id, role: user.role } };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ─── 1. منطق التسجيل
exports.registerLogic = async ({ name, email, password, phone }) => {
    let user = await userRepository.findByEmail(email);

    if (user && !user.isVerified) {
        const newOtp = generateOtp();
        user.verificationOtp = newOtp;
        user.name     = name;
        user.password = await bcrypt.hash(password, 10);
        await userRepository.saveUser(user);

        await sendEmail({
            email: user.email,
            subject: 'تفعيل حسابك في منصة عون ✉️',
            message: `
                <div style="font-family:sans-serif;text-align:center;direction:rtl;">
                    <h2 style="color:#006155;">أهلاً بك مجدداً في عون يا ${name}! 🎓</h2>
                    <p>يبدو أنك حاولت التسجيل مسبقاً ولم تفعل الحساب. إليك كود التفعيل الجديد:</p>
                    <div style="background:#f3f4f5;padding:20px;border-radius:10px;display:inline-block;margin:20px 0;">
                        <h1 style="color:#087c6e;font-size:40px;margin:0;letter-spacing:10px;">${newOtp}</h1>
                    </div>
                    <p style="color:#777;font-size:14px;">أدخل هذا الكود لتتمكن من استخدام حسابك.</p>
                </div>`
        });

        return {
            statusCode: 200,
            body: {
                msg: 'هذا الحساب موجود مسبقاً ولكنه غير مفعل، تم إرسال كود جديد لإيميلك ✉️',
                needsVerification: true,
                email: user.email
            }
        };
    }

    if (user && user.isVerified) {
        return {
            statusCode: 400,
            body: { msg: 'هذا الحساب موجود مسبقاً ومفعل بالفعل، يمكنك تسجيل الدخول.' }
        };
    }

    const isVerifiedStudent = email.endsWith('.edu') || email.endsWith('.edu.jo');
    const otp  = generateOtp();
    const salt = await bcrypt.genSalt(10);

    user = await userRepository.createUser({
        name,
        email,
        phone,
        password:        await bcrypt.hash(password, salt),
        isVerifiedStudent,
        isVerified:      false,
        verificationOtp: otp
    });

    await sendEmail({
        email: user.email,
        subject: 'تفعيل حسابك في منصة عون ✉️',
        message: `
            <div style="font-family:sans-serif;text-align:center;direction:rtl;">
                <h2 style="color:#006155;">مرحباً بك في مجتمع عون يا ${name}! 🎓</h2>
                <p>شكراً لانضمامك إلينا. لتفعيل حسابك، يرجى استخدام رمز التحقق التالي:</p>
                <div style="background:#f3f4f5;padding:20px;border-radius:10px;display:inline-block;margin:20px 0;">
                    <h1 style="color:#087c6e;font-size:40px;margin:0;letter-spacing:10px;">${otp}</h1>
                </div>
                <p style="color:#777;font-size:14px;">إذا لم تقم بإنشاء هذا الحساب، يرجى تجاهل هذه الرسالة.</p>
            </div>`
    });

    return {
        statusCode: 201,
        body: {
            msg: 'تم إنشاء الحساب بنجاح، يرجى تفقد بريدك الإلكتروني لتفعيل الحساب ✉️',
            user: {
                name:              user.name,
                email:             user.email,
                isVerifiedStudent: user.isVerifiedStudent,
                role:              user.role,
                isVerified:        user.isVerified
            }
        }
    };
};

// ─── 2. منطق تأكيد الإيميل
exports.verifyEmailLogic = async ({ email, otp }) => {
    const user = await userRepository.findByEmail(email);
    if (!user)             return { statusCode: 404, body: { msg: 'المستخدم غير موجود 🛑' } };
    if (user.isVerified)   return { statusCode: 400, body: { msg: 'هذا الحساب مفعل مسبقاً، يمكنك تسجيل الدخول مباشرة ✅' } };
    if (user.verificationOtp !== otp) return { statusCode: 400, body: { msg: 'رمز التحقق غير صحيح ❌' } };

    user.isVerified      = true;
    user.verificationOtp = undefined;
    await userRepository.saveUser(user);

    return { statusCode: 200, body: { msg: 'تم تفعيل حسابك بنجاح! يمكنك الآن تسجيل الدخول 🎉' } };
};

// ─── 3. منطق تسجيل الدخول
exports.loginLogic = async ({ email, password }) => {
    const user = await userRepository.findByEmailWithPassword(email);
    if (!user) return { statusCode: 400, body: { msg: 'البريد الإلكتروني غير صحيح' } };

    if (user.isBanned) return {
        statusCode: 403,
        body: { msg: 'هذا الحساب محظور بسبب مخالفة معايير مجتمع عون 🛑' }
    };

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return { statusCode: 400, body: { msg: 'كلمة الدخول غير صحيحة' } };

    if (!user.isVerified) return {
        statusCode: 403,
        body: {
            msg: 'حسابك غير مفعل! يرجى تفعيل حسابك باستخدام الرمز المرسل إلى بريدك ✉️',
            needsVerification: true,
            email: user.email
        }
    };

    const token = generateToken(user);

    return {
        statusCode: 200,
        body: {
            msg: 'تم تسجيل الدخول بنجاح',
            token,
            user: {
                name:              user.name,
                email:             user.email,
                isVerifiedStudent: user.isVerifiedStudent,
                role:              user.role,
                isVerified:        user.isVerified
            }
        }
    };
};

// ─── 4. منطق جلب بروفايل مستخدم
exports.getUserProfileLogic = async (userId) => {
    const [user, allDonations, completedRequests, totalRatings] = await Promise.all([
        userRepository.findById(userId),
        Item.find({ donor: userId }).populate('bookedBy', 'name avatar').sort({ createdAt: -1 }),
        Item.find({ bookedBy: userId, status: 'تم التسليم' }).populate('donor', 'name avatar').sort({ createdAt: -1 }),
        Item.countDocuments({ donor: userId, isRated: true })
    ]);

    if (!user) return { statusCode: 404, body: { msg: 'المستخدم غير موجود' } };

    return {
        statusCode: 200,
        body: {
            user,
            stats: {
                donationsCount:     allDonations.length,
                completedDonations: allDonations.filter(i => i.status === 'تم التسليم').length,
                receivedCount:      completedRequests.length,
                totalRatings
            },
            allDonations,
            completedRequests
        }
    };
};

// ─── 5. منطق نسيت كلمة المرور
exports.forgotPasswordLogic = async (email) => {
    const user = await userRepository.findByEmail(email);
    if (!user) return { statusCode: 404, body: { msg: 'لا يوجد حساب مسجل بهذا الإيميل' } };

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken  = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await userRepository.saveUser(user);

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl  = `${clientUrl}/reset-password/${resetToken}`;

    try {
        await sendEmail({
            email: user.email,
            subject: 'استعادة كلمة المرور - منصة عون 🔒',
            message: `
                <div dir="rtl">
                    <h2>طلب استعادة كلمة المرور</h2>
                    <p>لقد طلبت استعادة كلمة المرور لحسابك في منصة عون.</p>
                    <p>يرجى النقر على الرابط أدناه (صالح لمدة 15 دقيقة فقط):</p>
                    <a href="${resetUrl}" style="background:#006155;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">
                        إعادة تعيين كلمة المرور
                    </a>
                    <p style="margin-top:20px;font-size:12px;color:gray;">إذا لم تقم بهذا الطلب، يرجى تجاهل هذا البريد.</p>
                </div>`
        });

        return { statusCode: 200, body: { msg: 'تم إرسال رابط الاستعادة إلى بريدك الإلكتروني' } };
    } catch {
        user.resetPasswordToken  = undefined;
        user.resetPasswordExpire = undefined;
        await userRepository.saveUser(user);
        return { statusCode: 500, body: { msg: 'حدث خطأ أثناء إرسال البريد الإلكتروني' } };
    }
};

// ─── 6. منطق إعادة تعيين كلمة المرور
exports.resetPasswordLogic = async (token, newPassword) => {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await userRepository.findByResetToken(hashedToken);

    if (!user) return { statusCode: 400, body: { msg: 'الرابط غير صالح أو انتهت صلاحيته ❌' } };

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) return {
        statusCode: 400,
        body: { msg: 'يرجى اختيار كلمة مرور جديدة تختلف عن الحالية ❌' }
    };

    const salt = await bcrypt.genSalt(10);
    user.password            = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken  = undefined;
    user.resetPasswordExpire = undefined;
    await userRepository.saveUser(user);

    return { statusCode: 200, body: { msg: 'تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول ✅' } };
};
