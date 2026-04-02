const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["كتب", "إلكترونيات", "أثاث", "أخرى", "ملابس"],
      required: true,
      index: true, // ⚡ سرعة خيالية في البحث عن التصنيفات
    },
    imageUrl: { type: String, default: "" },
    // 🟢 ضفنا الحقول الناقصة هون عشان تتخزن صح
    location: {
      type: String,
      required: true,
      index: true, // ⚡ سرعة في البحث حسب الموقع
    },
    condition: { type: String, default: "مستعمل ممتاز" },
    isRated: {
      type: Boolean,
      default: false,
    },

    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // ⚡ لتسريع عرض "أغراضي" في الملف الشخصي
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deliveryOtp: { type: String },
    waitlist: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    reportCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["متاح", "محجوز", "تم التسليم", "مخفي"],
      default: "متاح",
      index: true, // ⚡ ضروري جداً لأنك غالباً بتعرض بس "المتاح"
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Item", itemSchema);
