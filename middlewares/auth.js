const jwt = require('jsonwebtoken');
const User = require('../models/User'); // ← تأكد من المسار الصحيح

module.exports = async function (req, res, next) {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ msg: 'لا يوجد توكن، الدخول مرفوض 🛑' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.user.id).select('isBanned');

    if (!user || user.isBanned) {
      return res.status(403).json({ msg: 'حسابك محظور 🚫' });
    }

    req.user = decoded.user;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ msg: 'التوكن غير صالح أو منتهي الصلاحية ⚠️' });
  }
};