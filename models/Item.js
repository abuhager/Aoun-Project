const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, enum: ['كتب', 'إلكترونيات', 'أثاث', 'أخرى','ملابس'], required: true },
    imageUrl: { type: String, default: '' },
    // 🟢 ضفنا الحقول الناقصة هون عشان تتخزن صح
    location: { type: String, required: true }, 
    condition: { type: String, default: 'مستعمل ممتاز' },
    isRated: {
    type: Boolean,
    default: false
},
    
    donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deliveryOtp: { type: String },
    waitlist: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now }
    }],
    reportCount: { type: Number, default: 0 },
    status: { 
        type: String, 
        enum: ['متاح', 'محجوز', 'تم التسليم', 'مخفي'], 
        default: 'متاح' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);