// middlewares/validateObjectId.js
// ============================================================
// ✅ PHASE 1 — NEW FILE
// الغرض: التحقق من أن :id صالح كـ MongoDB ObjectId
// يمنع: CastError + injection
// ============================================================
const mongoose = require('mongoose');

module.exports = function validateObjectId(req, res, next) {
  const id = req.params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ msg: 'معرّف غير صالح' });
  }
  next();
};
