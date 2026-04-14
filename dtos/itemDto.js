// backend/dtos/itemDto.js
const Joi = require('joi');

exports.validateCreateItem = (data) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(50).required().messages({
            'string.empty': 'اسم الغرض مطلوب',
            'string.min': 'اسم الغرض يجب أن يكون 3 أحرف على الأقل'
        }),
        category: Joi.string().required().messages({
            'string.empty': 'التصنيف مطلوب'
        }),
        description: Joi.string().allow('').max(500),
        // بنسمح بتمرير صورة، بس رح نعالجها لحال بالميدل وير
    }).unknown(true); // عشان يسمح بأي بيانات إضافية (زي الصورة) مؤقتاً

    return schema.validate(data);
};