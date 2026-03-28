const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, enum: ['كتب', 'إلكترونيات', 'أثاث', 'أخرى'], required: true },
    imageUrl: { type: String, default: '' },
    donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    
    waitlist: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now }
    }],

    reportCount: { type: Number, default: 0 }, // عدد الإبلاغات
    status: { 
        type: String, 
        enum: ['متاح', 'محجوز', 'تم التسليم', 'مخفي'], // تم إضافة "مخفي" للمشرفين
        default: 'متاح' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);