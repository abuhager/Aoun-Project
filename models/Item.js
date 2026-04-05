const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["كتب", "إلكترونيات", "أثاث", "أخرى", "ملابس"],
      required: true,
      index: true,
    },
    imageUrl:    { type: String, default: "" },
    cloudinaryId:{ type: String },
    location: {
      type: String,
      required: true,
      index: true,
    },
    condition:   { type: String, default: "مستعمل ممتاز" },
    isRated:     { type: Boolean, default: false },
    bookedAt: { type: Date, default: null },

    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ✅ الصياغة الصحيحة للـ array
    cancelledBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
        select: false 
    }],

    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ✅ select: false للأمان — لا يُرجع في الـ API إلا لو طلبته صراحةً
    deliveryOtp: {
      type: String,
      select: false
    },

    waitlist: [{
      user:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      joinedAt: { type: Date, default: Date.now },
    }],

    reportCount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["متاح", "محجوز", "تم التسليم", "مخفي"],
      default: "متاح",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Item", itemSchema);