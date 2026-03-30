const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
phone: { type: String },
reportsCount: { type: Number, default: 0 }, // عدد البلاغات اللي أكلها هاد الشخص
isBanned: { type: Boolean, default: false }, // هل الحساب محظور؟
resetPasswordToken: String,
  resetPasswordExpire: Date,
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
    trustScore: { type: Number, default: 70 }, // نقاط الثقة تبدأ من 100
    quota: { type: Number, default: 3 }, // الحصة الأسبوعية (مثلاً 3 أغراض)
  },
  
  
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
