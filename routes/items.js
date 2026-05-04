const express = require('express');
const router  = express.Router();
const upload  = require('../middlewares/upload');
const auth    = require('../middlewares/auth');
const {
  createItem, getItems, bookItem, cancelBooking,
  updateItem, deleteItem, completeDelivery,
  getItemById, getMyItems, rateItem, reportUser, getPendingRating
} = require('../controllers/itemController');

// ─── مسارات القراءة ───
router.get('/',               getItems);
router.get('/me',        auth, getMyItems);
router.get('/pending-rating', auth, getPendingRating); // ✅ قبل /:id

router.get('/:id',            getItemById); // ← لازم يكون آخر GET

// ─── مسارات الإنشاء والتعديل ───
router.post('/',              [auth, upload.single('image')], createItem);
router.put('/update/:id',     [auth, upload.single('image')], updateItem);
router.delete('/delete/:id',  auth, deleteItem);

// ─── مسارات العمليات ───
router.put('/book/:id',       auth, bookItem);
router.put('/cancel/:id',     auth, cancelBooking);
router.put('/complete/:id',   auth, completeDelivery);
router.put('/rate/:id',       auth, rateItem);

// ─── مسارات التبليغ ───
router.post('/report-user',   auth, reportUser);

module.exports = router;