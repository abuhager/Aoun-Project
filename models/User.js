// models/User.js
// ============================================================
// ✅ PHASE 1 — UPDATED SCHEMA
// التغييرات:
//   + trustLevel (1|2) — أساس Trust System
//   + phoneVerified   — للتحقق عبر WhatsApp OTP
//   + otpExpiry       — انتهاء صلاحية OTP
//   + trustScore indexes للـ Leaderboard
//   ~ verificationOtp — select: false (لا يُرجَع أبداً)
// BLAST RADIUS:
//   Direct:       User.findById → حقول جديدة متاحة
//   Cross-Repo:   Frontend user.types.ts يحتاج تحديث
//   DB Migration: بدون breaking change — حقول جديدة nullable
// ============================================================
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    reportedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // ─── Auth & Security ──────────────────────────────────
    role: {
      type: String,
      enum: ['user', 'admin', 'super_admin'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationOtp: {
      type: String,
      select: false, // ✅ لا يُرجَع أبداً في الـ API
    },
    otpExpiry: {
      type: Date,
      select: false, // ✅ NEW
    },
    refreshToken: {
      type: String,
      select: false, // ✅ لا يُرجَع أبداً
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },

    // ─── Trust System ─────────────────────────────────────
    trustLevel: {
      type: Number,
      enum: [1, 2],
      default: 1,
    },
    isVerifiedStudent: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false, // ✅ NEW — WhatsApp OTP
    },
    trustScore: {
      type: Number,
      default: 70,
      min: 0,
      max: 200,
    },

    // ─── Activity & Status ───────────────────────────────
    isBanned: {
      type: Boolean,
      default: false,
    },
    quota: {
      type: Number,
      default: 2,
      min: 0,
    },
    avatar: {
      type: String,
      default: '',
    },

    // ─── Gamification ────────────────────────────────────
    totalDonations: {
      type: Number,
      default: 0,
    },
    badges: {
      type: [String],
      default: [],
    },
    monthlyDonations: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────
UserSchema.index({ email: 1 });
UserSchema.index({ trustLevel: 1 });
UserSchema.index({ trustScore: -1 }); // للـ Leaderboard

module.exports = mongoose.model('User', UserSchema);
