// models/Item.js
const mongoose = require('mongoose');

const waitlistEntrySchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now },
}, { _id: false });

const ItemSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  category:    { type: String, required: true },
  description: { type: String, required: true },
  location:    { type: String, required: true },
  condition:   { type: String, enum: ['ممتاز', 'جيد', 'مقبول'], required: true },
  imageUrl:    { type: String },
  cloudinaryId:{ type: String },

  donor:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  bookedAt:    { type: Date },

  status: {
    type: String,
    enum: ['متاح', 'محجوز', 'تم التسليم', 'مخفي'],
    default: 'متاح',
  },

  deliveryOtp: { type: String, select: false },

  // تقييم المتبرع من المستلم
  isRated:         { type: Boolean, default: false },
  // تقييم المستلم من المتبرع ✨ جديد
  isReceiverRated: { type: Boolean, default: false },

  waitlist:    { type: [waitlistEntrySchema], default: [] },
  cancelledBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Item', ItemSchema);
