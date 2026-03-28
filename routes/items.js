const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth'); // 👮‍♂️ استدعينا الحارس
const { createItem, getItems ,bookItem, cancelBooking , updateItem} = require('../controllers/itemController'); // لا تنسى تضيف getItems بالاستدعاء فوق

// مسار إضافة غرض: http://localhost:5000/api/items
// لاحظ كيف حطينا (auth) بالنص! يعني الطلب بيمر عالحارس، إذا تمام بيكمل لـ createItem
router.post('/', auth, createItem);

// مسار جلب الأغراض: http://localhost:5000/api/items
// ملاحظة: هاد المسار خليناه بدون حارس (auth) عشان أي طالب يقدر يتصفح الموقع، بس ما بيقدر يطلب غرض إلا بس يسجل دخول
router.get('/', getItems);
// مسار الحجز: http://localhost:5000/api/items/book/:id
router.put('/book/:id', auth, bookItem);

// مسار إلغاء الحجز: http://localhost:5000/api/items/cancel/:id
router.put('/cancel/:id', auth, cancelBooking);

// مسار تعديل الغرض: http://localhost:5000/api/items/:id
router.put('/:id', auth, updateItem);

module.exports = router;