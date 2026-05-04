// routes/items.js - النسخة النهائية المحسنة
const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload'); // لرفع الصور
const auth = require('../middlewares/auth'); // مصادقة JWT
const validateObjectId = require('../middlewares/validateObjectId'); // ✅ التحقق من ObjectId

// استيراد الـ controllers
const {
  createItem, getItems, getItemById, getMyItems, getPendingRating,
  updateItem, deleteItem, bookItem, cancelBooking, completeDelivery, rateItem, reportUser
} = require('../controllers/itemController');

// مسارات القراءة العامة (لا تحتاج auth إلا الشخصية)
router.get('/', getItems); // جميع الغراض المتاحة
router.get('/me', auth, getMyItems); // غراضي أنا فقط
router.get('/pending-rating', auth, getPendingRating); // ✅ قبل /:id عشان ما يتعارض
router.get('/:id', validateObjectId, getItemById); // غرض واحد بـ ID صالح

// إنشاء وتعديل (تحتاج auth + صورة اختيارية)
router.post('/', [auth, upload.single('image')], createItem);
router.put('/update/:id', [auth, validateObjectId, upload.single('image')], updateItem);
router.delete('/delete/:id', [auth, validateObjectId], deleteItem);

// عمليات الحجز والتسليم (ID صالح مطلوب)
router.put('/book/:id', [auth, validateObjectId], bookItem);
router.put('/cancel/:id', [auth, validateObjectId], cancelBooking);
router.put('/complete/:id', [auth, validateObjectId], completeDelivery);
router.put('/rate/:id', [auth, validateObjectId], rateItem);

// تبليغ (لا يحتاج ID)
router.post('/report-user', auth, reportUser);

module.exports = router;