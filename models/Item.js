const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['كتب', 'إلكترونيات', 'أثاث', 'أخرى'], // حسب خطتنا للمواد الفائضة
        required: true
    },
    // رابط الصورة اللي رح نرفعه على Cloudinary بعدين
    imageUrl: {
        type: String,
        default: ''
    },
    // الشخص اللي تبرع بالغرض
    donor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // الشخص اللي حجز الغرض فعلياً (الأول)
    bookedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    // نظام الطابور (Waitlist) اللي فكرت فيه
    waitlist: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            joinedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    status: {
        type: String,
        enum: ['متاح', 'محجوز', 'تم التسليم'],
        default: 'متاح'
    }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);