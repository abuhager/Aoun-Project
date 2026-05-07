const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const userRepository = require('../repositories/userRepository');
const Item = require('../models/Item');
const {
  generateAccessToken,
  generateRefreshToken,
} = require('../utils/tokenUtils');

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const formatPhone = (phone = '') => {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return '962' + digits.slice(1);
  if (digits.startsWith('7')) return '962' + digits;
  return digits;
};

exports.registerLogic = async ({ name, email, password, phone }) => {
  let user = await userRepository.findByEmail(email);

  if (user && !user.isVerified) {
    const newOtp = generateOtp();
    user.verificationOtp = newOtp;
    user.name = name;
    user.password = await bcrypt.hash(password, 10);
    await userRepository.saveUser(user);

    await sendEmail({
      email: user.email,
      subject: 'تفعيل حسابك في منصة عون ✉️',
      message: `<div style="font-family:sans-serif;text-align:center;direction:rtl;"><h2 style="color:#006155;">أهلاً بك مجدداً في عون يا ${name}! 🎓</h2><p>كود التفعيل الجديد:</p><div style="background:#f3f4f5;padding:20px;border-radius:10px;display:inline-block;margin:20px 0;"><h1 style="color:#087c6e;font-size:40px;margin:0;letter-spacing:10px;">${newOtp}</h1></div></div>`,
    });

    return {
      statusCode: 200,
      body: {
        msg: 'هذا الحساب موجود مسبقاً ولكنه غير مفعل، تم إرسال كود جديد لإيميلك ✉️',
        needsVerification: true,
        email: user.email,
      },
    };
  }

  if (user && user.isVerified) {
    return {
      statusCode: 400,
      body: { msg: 'هذا الحساب موجود مسبقاً ومفعل، يمكنك تسجيل الدخول.' },
    };
  }

  const isVerifiedStudent = email.endsWith('.edu') || email.endsWith('.edu.jo');
  const otp = generateOtp();
  const salt = await bcrypt.genSalt(10);

  user = await userRepository.createUser({
    name,
    email,
    phone,
    password: await bcrypt.hash(password, salt),
    isVerifiedStudent,
    isVerified: false,
    verificationOtp: otp,
  });

  await sendEmail({
    email: user.email,
    subject: 'تفعيل حسابك في منصة عون ✉️',
    message: `<div style="font-family:sans-serif;text-align:center;direction:rtl;"><h2 style="color:#006155;">مرحباً بك في عون يا ${name}! 🎓</h2><p>رمز التحقق:</p><div style="background:#f3f4f5;padding:20px;border-radius:10px;display:inline-block;margin:20px 0;"><h1 style="color:#087c6e;font-size:40px;margin:0;letter-spacing:10px;">${otp}</h1></div></div>`,
  });

  return {
    statusCode: 201,
    body: {
      msg: 'تم إنشاء الحساب بنجاح، يرجى تفقد بريدك الإلكتروني لتفعيل الحساب ✉️',
      user: {
        name: user.name,
        email: user.email,
        isVerifiedStudent: user.isVerifiedStudent,
        role: user.role,
        isVerified: user.isVerified,
      },
    },
  };
};

exports.verifyEmailLogic = async ({ email, otp }) => {
  const user = await userRepository.findByEmail(email);

  if (!user) {
    return { statusCode: 404, body: { msg: 'المستخدم غير موجود 🛑' } };
  }

  if (user.isVerified) {
    return { statusCode: 400, body: { msg: 'هذا الحساب مفعل مسبقاً ✅' } };
  }

  if (user.verificationOtp !== otp) {
    return { statusCode: 400, body: { msg: 'رمز التحقق غير صحيح ❌' } };
  }

  user.isVerified = true;
  user.verificationOtp = undefined;
  await userRepository.saveUser(user);

  return {
    statusCode: 200,
    body: { msg: 'تم تفعيل حسابك بنجاح! 🎉' },
  };
};

exports.loginLogic = async ({ email, password }) => {
  const user = await userRepository.findByEmailWithPassword(email);

  if (!user)
    return { statusCode: 400, body: { msg: 'البريد الإلكتروني غير صحيح' } };

  if (user.isBanned)
    return { statusCode: 403, body: { msg: 'هذا الحساب محظور 🛑' } };

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch)
    return { statusCode: 400, body: { msg: 'كلمة الدخول غير صحيحة' } };

  if (!user.isVerified)
    return {
      statusCode: 403,
      body: { msg: 'حسابك غير مفعل ✉️', needsVerification: true, email: user.email },
    };

  // ✅ Access Token قصير
  const accessToken = generateAccessToken(user);

  // ✅ Refresh Token طويل
  const refreshToken = generateRefreshToken(user);

  // ✅ احفظ الـ hash في DB
  const hashedRefreshToken = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');

  await userRepository.updateUser(user._id, {
    refreshToken: hashedRefreshToken,
  });

  return {
    statusCode: 200,
    refreshToken, // ← يُرسل للكوكي في الـ controller
    body: {
      msg: 'تم تسجيل الدخول بنجاح',
      accessToken,
      user: {
        name: user.name,
        email: user.email,
        isVerifiedStudent: user.isVerifiedStudent,
        role: user.role,
        isVerified: user.isVerified,
      },
    },
  };
};
exports.refreshTokenLogic = async (token) => {
  if (!token) {
    return {
      statusCode: 401,
      body: { msg: 'لا يوجد Refresh Token 🛑', code: 'NO_REFRESH_TOKEN' },
    };
  }

  try {
    // 1) فك التوكن
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    // 2) هش التوكن القادم
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // 3) جيب المستخدم من الـ DB
const user = await userRepository.findByIdWithRefreshToken(decoded.user.id);
    // 🔍 هنا مكان الـ console.log الصحيح
    console.log('🔍 user.refreshToken in DB:', user && user.refreshToken);
    console.log('🔍 hashedToken incoming:', hashedToken);

    // 4) تحقق من وجود المستخدم
    if (!user || user.isBanned) {
      return {
        statusCode: 401,
        clearCookie: true,
        body: { msg: 'الجلسة غير صالحة 🛑', code: 'INVALID_SESSION' },
      };
    }

    // 5) لا يوجد refreshToken مخزَّن في DB
    if (!user.refreshToken) {
      return {
        statusCode: 401,
        clearCookie: true,
        body: { msg: 'لا توجد جلسة محفوظة', code: 'NO_STORED_SESSION' },
      };
    }

    // 6) مقارنة الـ hash المخزَّن بالوارد
    if (user.refreshToken !== hashedToken) {
      return {
        statusCode: 401,
        clearCookie: false,
        body: { msg: 'Refresh Token غير مطابق', code: 'REFRESH_MISMATCH' },
      };
    }

    // 7) إصدار tokens جديدين + تخزين hash الجديد
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    const newHashedRefreshToken = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');

    await userRepository.updateUser(user._id, {
      refreshToken: newHashedRefreshToken,
    });

    return {
      statusCode: 200,
      refreshToken: newRefreshToken,
      body: {
        msg: 'تم تجديد الجلسة بنجاح',
        accessToken: newAccessToken,
      },
    };
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';

    return {
      statusCode: 401,
      clearCookie: true,
      body: {
        msg: isExpired ? 'انتهت صلاحية الجلسة ⏰' : 'جلسة غير صالحة ⚠️',
        code: isExpired ? 'REFRESH_EXPIRED' : 'INVALID_REFRESH',
      },
    };
  }
};

exports.logoutLogic = async (userId) => {
  await userRepository.updateUser(userId, {
    $unset: { refreshToken: 1 },
  });

  return {
    statusCode: 200,
    body: { msg: 'تم تسجيل الخروج بنجاح 👋' },
  };
};

exports.getUserProfileLogic = async (userId) => {
  const [user, allDonations, completedRequests, totalRatings] = await Promise.all([
    userRepository.findById(userId),
    Item.find({ donor: userId }).populate('bookedBy', 'name avatar').sort({ createdAt: -1 }),
    Item.find({ bookedBy: userId, status: 'تم التسليم' }).populate('donor', 'name avatar').sort({ createdAt: -1 }),
    Item.countDocuments({ donor: userId, isRated: true }),
  ]);

  if (!user) {
    return { statusCode: 404, body: { msg: 'المستخدم غير موجود' } };
  }

  return {
    statusCode: 200,
    body: {
      user,
      stats: {
        donationsCount: allDonations.length,
        completedDonations: allDonations.filter((i) => i.status === 'تم التسليم').length,
        receivedCount: completedRequests.length,
        totalRatings,
      },
      allDonations,
      completedRequests,
    },
  };
};

exports.getPublicProfileLogic = async (userId) => {
  const [user, allDonations, completedRequests, totalRatings] = await Promise.all([
    userRepository.findById(userId),
    Item.find({ donor: userId, status: { $ne: 'مخفي' } })
      .select('title imageUrl status createdAt')
      .sort({ createdAt: -1 }),
    Item.find({ bookedBy: userId, status: 'تم التسليم' })
      .select('title imageUrl status createdAt')
      .sort({ createdAt: -1 }),
    Item.countDocuments({ donor: userId, isRated: true }),
  ]);

  if (!user) {
    return { statusCode: 404, body: { msg: 'المستخدم غير موجود' } };
  }

  if (user.isBanned) {
    return { statusCode: 403, body: { msg: 'هذا الحساب محظور' } };
  }

  return {
    statusCode: 200,
    body: {
      user: {
        name: user.name,
        avatar: user.avatar,
        trustScore: user.trustScore,
        totalDonations: user.totalDonations,
        isVerifiedStudent: user.isVerifiedStudent,
        createdAt: user.createdAt,
        whatsapp: formatPhone(user.phone),
      },
      stats: {
        donationsCount: allDonations.length,
        receivedCount: completedRequests.length,
        totalRatings,
      },
      allDonations,
      completedRequests,
    },
  };
};

exports.forgotPasswordLogic = async (email) => {
  const user = await userRepository.findByEmail(email);

  if (!user) {
    return {
      statusCode: 404,
      body: { msg: 'لا يوجد حساب مسجل بهذا الإيميل' },
    };
  }

  const resetToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
  await userRepository.saveUser(user);

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'استعادة كلمة المرور - منصة عون 🔒',
      message: `<div dir="rtl"><h2>طلب استعادة كلمة المرور</h2><a href="${resetUrl}" style="background:#006155;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">إعادة تعيين كلمة المرور</a></div>`,
    });

    return {
      statusCode: 200,
      body: { msg: 'تم إرسال رابط الاستعادة إلى بريدك الإلكتروني' },
    };
  } catch {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await userRepository.saveUser(user);

    return {
      statusCode: 500,
      body: { msg: 'حدث خطأ أثناء إرسال البريد الإلكتروني' },
    };
  }
};

exports.resetPasswordLogic = async (token, newPassword) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await userRepository.findByResetToken(hashedToken);

  if (!user) {
    return {
      statusCode: 400,
      body: { msg: 'الرابط غير صالح أو انتهت صلاحيته ❌' },
    };
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    return {
      statusCode: 400,
      body: { msg: 'يرجى اختيار كلمة مرور جديدة تختلف عن الحالية ❌' },
    };
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await userRepository.saveUser(user);

  return {
    statusCode: 200,
    body: { msg: 'تم تغيير كلمة المرور بنجاح! ✅' },
  };
};