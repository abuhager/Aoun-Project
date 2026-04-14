const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload'); // 📦 استدعاء العتّال
const auth = require('../middlewares/auth'); // 👮‍♂️ استدعينا الحارس
const { createItem, getItems, bookItem, cancelBooking, updateItem, deleteItem, completeDelivery, getItemById, getMyItems, rateItem, reportUser } = require('../controllers/itemController');

// ─── مسارات القراءة (متاحة للجميع باستثناء الأغراض الشخصية) ───
router.get('/', getItems);
router.get('/:id', getItemById);
router.get('/me', auth, getMyItems); // 👮‍♂️ الأغراض الشخصية تحتاج حارس

// ─── مسارات الإنشاء والتعديل (تحتاج تسجيل دخول) ───
router.post('/', [auth, upload.single('image')], createItem);
router.put('/update/:id', [auth, upload.single('image')], updateItem);
router.delete('/delete/:id', auth, deleteItem);

// ─── مسارات العمليات على الغرض (حجز، إلغاء، تسليم، تقييم) ───
router.put('/book/:id', auth, bookItem);
router.put('/cancel/:id', auth, cancelBooking);
router.put('/complete/:id', auth, completeDelivery);
router.put('/rate/:id', auth, rateItem);

// ─── مسارات التبليغ ───
router.post('/report-user', auth, reportUser);

module.exports = router;