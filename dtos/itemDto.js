// backend/dtos/itemDto.js
const Joi = require('joi');

// ============================================
// 1. Validation — التحقق من البيانات الواردة
// ============================================

exports.validateCreateItem = (data) => {
  const schema = Joi.object({
    title: Joi.string().min(3).max(100).required().messages({
      'string.empty': 'اسم الغرض مطلوب',
      'string.min':   'اسم الغرض يجب أن يكون 3 أحرف على الأقل',
    }),
    category: Joi.string()
      .valid('كتب', 'إلكترونيات', 'أثاث', 'أخرى', 'ملابس')
      .required()
      .messages({
        'string.empty': 'التصنيف مطلوب',
        'any.only':     'التصنيف غير صحيح',
      }),
    description: Joi.string().allow('').max(500),
    location:    Joi.string().required().messages({
      'string.empty': 'الموقع مطلوب',
    }),
    condition: Joi.string().allow('').max(100),
  }).unknown(true);
  return schema.validate(data);
};

exports.validateUpdateItem = (data) => {
  const schema = Joi.object({
    title:       Joi.string().min(3).max(100),
    category:    Joi.string().valid('كتب', 'إلكترونيات', 'أثاث', 'أخرى', 'ملابس'),
    description: Joi.string().allow('').max(500),
    location:    Joi.string(),
    condition:   Joi.string().allow('').max(100),
  }).unknown(true);
  return schema.validate(data);
};

// ============================================
// 2. Transformations — تشكيل بيانات الـ Response
// ============================================

// للعموم — بدون أي بيانات حساسة
exports.toPublicItem = (item) => ({
  _id:           item._id,
  title:         item.title,
  description:   item.description,
  category:      item.category,
  location:      item.location,
  condition:     item.condition,
  imageUrl:      item.imageUrl,
  status:        item.status,
  reportCount:   item.reportCount,
  waitlistCount: item.waitlist?.length ?? 0,
  // ✅ مضاف — كان مفقوداً
  bookedAt:      item.bookedAt,
  isRated:       item.isRated,
  handoverMode:  item.handoverMode,
  hubId:         item.hubId,
  createdAt:     item.createdAt,
  donor: item.donor ? {
    _id:               item.donor._id,
    name:              item.donor.name,
    trustScore:        item.donor.trustScore,
    avatar:            item.donor.avatar,
    isVerifiedStudent: item.donor.isVerifiedStudent,
  } : null,
  bookedBy: item.bookedBy ? {
    _id:  item.bookedBy._id,
    name: item.bookedBy.name,
  } : null,
});

// للمتبرع — يرى بيانات الحاجز (email + phone) لكن ❌ بدون OTP
exports.toDonorItem = (item) => ({
  ...exports.toPublicItem(item),
  // ✅ OTP مُزال من الـ response نهائياً
  // الـ OTP يُرسَل للمتبرع عبر email فقط عند الحجز
  bookedBy: item.bookedBy ? {
    _id:   item.bookedBy._id,
    name:  item.bookedBy.name,
    phone: item.bookedBy.phone,
    email: item.bookedBy.email,
  } : null,
});

// للمستلم — يرى بيانات المتبرع (phone) لكن ❌ بدون OTP
exports.toReceiverItem = (item) => ({
  ...exports.toPublicItem(item),
  // ✅ OTP مُزال من الـ response نهائياً
  // الـ OTP يُرسَل للمستلم عبر email فقط عند الحجز
  donor: item.donor ? {
    _id:               item.donor._id,
    name:              item.donor.name,
    phone:             item.donor.phone,
    trustScore:        item.donor.trustScore,
    isVerifiedStudent: item.donor.isVerifiedStudent,
  } : null,
});