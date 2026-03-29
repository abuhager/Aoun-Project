const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },

    // الإضافات الجديدة حسب خطتك:
    role: {
      type: String,
      default: "user",
      enum: ["user", "admin", "super_admin"],
    },
    isVerified: {
      type: Boolean,
      default: false, // أول ما يسجل بكون حسابه مش مفعل
    },
    verificationOtp: {
      type: String, // هون بنخزن كود التفعيل المكون من 4 أرقام
    },
    isVerifiedStudent: { type: Boolean, default: false }, // شارة الطالب الموثق
    trustScore: { type: Number, default: 100 }, // نقاط الثقة تبدأ من 100
    quota: { type: Number, default: 3 }, // الحصة الأسبوعية (مثلاً 3 أغراض)
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
