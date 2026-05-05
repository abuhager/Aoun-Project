// middlewares/requireLevel2.js
// ============================================================
// ✅ PHASE 1/2 — NEW FILE
// الغرض: يمنع الحجز إلا لمن وصل Trust Level 2
// شروط Level 2:
//   (أ) isVerifiedStudent = true  ← جامعي تلقائي
//   (ب) phoneVerified = true      ← WhatsApp OTP يدوي
//   (ج) trustLevel = 2            ← Admin رفعه يدوياً
// يُطبَّق على: PUT /api/items/book/:id
// ============================================================
const User = require('../models/User');

module.exports = async function requireLevel2(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ msg: 'يجب تسجيل الدخول أولاً' });
    }

    const user = await User.findById(req.user.id)
      .select('trustLevel isVerifiedStudent phoneVerified isBanned');

    if (!user) {
      return res.status(401).json({ msg: 'المستخدم غير موجود' });
    }

    if (user.isBanned) {
      return res.status(403).json({ msg: 'حسابك موقوف. تواصل مع الدعم.' });
    }

    const isLevel2 =
      user.trustLevel >= 2 ||
      user.isVerifiedStudent === true ||
      user.phoneVerified === true;

    if (!isLevel2) {
      return res.status(403).json({
        msg: 'يجب التحقق من هويتك للحجز',
        code: 'REQUIRES_LEVEL2',
        hint: 'يمكنك التحقق عبر البريد الجامعي أو رقم الهاتف',
      });
    }

    next();
  } catch (err) {
    console.error('requireLevel2 error:', err.message);
    res.status(500).json({ msg: 'خطأ في التحقق من الصلاحيات' });
  }
};
