// middlewares/validateObjectId.js
const mongoose = require('mongoose');

/**
 * Middleware: يتحقق إن الـ :id في الـ URL هو ObjectId صالح
 * يُستخدم على أي route فيه /:id
 * 
 * مثال الاستخدام:
 *   router.get('/:id', validateObjectId, getItemById);
 */
module.exports = function validateObjectId(req, res, next) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      msg: 'معرّف الغرض غير صالح',
    });
  }

  next();
};