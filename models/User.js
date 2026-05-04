const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, index: true },

    // ✅ select: false — لن يُرجع في أي query إلا لو طلبته صراحةً بـ .select('+password')
    password: { type: String, required: true, select: false },

    phone:    { type: String },
    reportedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    avatar:   { type: String, default: "" },
    isBanned: { type: Boolean, default: false },

    resetPasswordToken:  String,
    resetPasswordExpire: Date,

    role: {
      type:    String,
      default: "user",
      enum:    ["user", "admin", "super_admin"],
    },

    isVerified: { type: Boolean, default: false },
    verificationOtp: { type: String },

    isVerifiedStudent: { type: Boolean, default: false },
    trustScore:        { type: Number, default: 70 },
    quota:             { type: Number, default: 2 },

    // ✅ جديد — المرحلة 1
    refreshToken:   { type: String, select: false },        // للـ Refresh Token (HttpOnly Cookie)
    totalDonations: { type: Number, default: 0 },           // عدد التبرعات المكتملة (للـ Leaderboard)
    badges:         { type: [String], default: [] },        // الأوسمة: ['first_donation', 'top_donor', ...]
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);