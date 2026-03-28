const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth'); // 👮‍♂️ استدعينا الحارس
const { createItem } = require('../controllers/itemController');

// مسار إضافة غرض: http://localhost:5000/api/items
// لاحظ كيف حطينا (auth) بالنص! يعني الطلب بيمر عالحارس، إذا تمام بيكمل لـ createItem
router.post('/', auth, createItem);

module.exports = router;