// models/User.js
// ============================================================
// ✅ PHASE 1 — UPDATED SCHEMA
// التغييرات:
//   + trustLevel (1|2) — أساس Trust System
//   + phoneVerified   — للتحقق عبر WhatsApp OTP
//   + otpExpiry       — انتهاء صلاحية OTP
//   + trustScore indexes للـ Leaderboard
//   ~ verificationOtp — select: false (لا يُرجَع أبداً)
//
// FIX: حذف UserSchema.index({ email: 1 }) المكرر
//   email عنده unique: true أصلاً وهذا ينشئ index تلقائياً
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
      unique: true,      // ✅ هذا ينشئ index تلقائياً — لا تضيف index يدوي
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

    // ─── Auth & Security ───────────────────────────────────
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
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
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
      default: false,
    },
    trustScore: {
      type: Number,
      default: 70,
      min: 0,
      max: 200,
    },

    // ─── Activity & Status ────────────────────────────────
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

// ─── Indexes ─────────────────────────────────────────────
// ❌ حذف: UserSchema.index({ email: 1 }) — مكرر مع unique: true
UserSchema.index({ trustLevel: 1 });
UserSchema.index({ trustScore: -1 }); // للـ Leaderboard

module.exports = mongoose.model('User', UserSchema);
