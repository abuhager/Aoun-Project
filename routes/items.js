const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth'); // 👮‍♂️ استدعينا الحارس
const { createItem, getItems ,bookItem, cancelBooking , updateItem, deleteItem, completeDelivery} = require('../controllers/itemController'); // لا تنسى تضيف getItems بالاستدعاء فوق

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

// مسار تعديل الغرض: http://localhost:5000/api/items/update/:id
router.put('/update/:id', auth, updateItem);

// مسار حذف الغرض: http://localhost:5000/api/items/delete/:id
router.delete('/delete/:id', auth, deleteItem);

// مسار إتمام التسليم: http://localhost:5000/api/items/deliver/:id
router.put('/deliver/:id', auth, completeDelivery);

module.exports = router;