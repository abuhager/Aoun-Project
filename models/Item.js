const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type:     String,
      enum:     ["كتب", "إلكترونيات", "أثاث", "أخرى", "ملابس"],
      required: true,
      index:    true,
    },
    imageUrl:     { type: String, default: "" },
    cloudinaryId: { type: String },
    location: {
      type:     String,
      required: true,
      index:    true,
    },
    condition: { type: String, default: "مستعمل ممتاز" },
    isRated:   { type: Boolean, default: false },
    bookedAt:  { type: Date, default: null },

    donor: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    cancelledBy: [
      {
        type:   mongoose.Schema.Types.ObjectId,
        ref:    "User",
        select: false,
      },
    ],

    bookedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    deliveryOtp: { type: String, select: false },

    waitlist: [
      {
        user:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],

    reportCount: { type: Number, default: 0 },

    status: {
      type:    String,
      enum:    ["متاح", "محجوز", "تم التسليم", "مخفي"],
      default: "متاح",
      index:   true,
    },

    // ✅ جديد — المرحلة 1
    handoverMode: {
      type:    String,
      enum:    ["direct", "hub"],   // مباشر أو عبر مركز تسليم
      default: "direct",
    },
    hubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "SafeHub",              // Model سيُنشأ في المرحلة 2
      default: null,
    },
    hubDropOtp:   { type: String, select: false }, // OTP تسليم المتبرع للهاب
    hubPickupOtp: { type: String, select: false }, // OTP استلام المستفيد من الهاب
    rating: {
      type:    Number,
      min:     1,
      max:     5,
      default: null,                // التقييم الفعلي (للإحصائيات)
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Item", itemSchema);