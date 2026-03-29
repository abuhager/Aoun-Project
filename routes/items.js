const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload'); // استدعاء العتّال
const auth = require('../middlewares/auth'); // 👮‍♂️ استدعينا الحارس
const { createItem, getItems ,bookItem, cancelBooking , updateItem, deleteItem, completeDelivery,getItemById,getMyItems,rateItem, reportUser} = require('../controllers/itemController'); // لا تنسى تضيف getItems بالاستدعاء فوق

// مسار إضافة غرض جديد (مع صورة)
// استخدمنا upload.single('image') عشان نستقبل ملف واحد اسمه 'image'
router.post('/', [auth, upload.single('image')], createItem);

// مسار جلب الأغراض: http://localhost:5000/api/items
// ملاحظة: هاد المسار خليناه بدون حارس (auth) عشان أي طالب يقدر يتصفح الموقع، بس ما بيقدر يطلب غرض إلا بس يسجل دخول
router.get('/', getItems);
router.get('/me', auth, getMyItems);
router.get('/:id', getItemById);
// مسار الحجز: http://localhost:5000/api/items/book/:id

router.put('/book/:id', auth, bookItem);

// مسار إلغاء الحجز: http://localhost:5000/api/items/cancel/:id
router.put('/cancel/:id', auth, cancelBooking);

// مسار تعديل الغرض: http://localhost:5000/api/items/update/:id
router.put('/update/:id', auth, updateItem);

// مسار حذف الغرض: http://localhost:5000/api/items/delete/:id
router.delete('/delete/:id', auth, deleteItem);

// مسار إتمام التسليم: http://localhost:5000/api/items/complete/:id
router.put('/complete/:id', auth, completeDelivery);
router.put('/rate/:id', auth,rateItem);
router.post('/report-user', auth, reportUser);
module.exports = router;