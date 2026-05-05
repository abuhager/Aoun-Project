// routes/items.js
const express          = require('express');
const router           = express.Router();
const auth             = require('../middlewares/auth');
const optionalAuth     = require('../middlewares/optionalAuth');
const requireLevel2    = require('../middlewares/requireLevel2');
const validateObjectId = require('../middlewares/validateObjectId');
const upload           = require('../middlewares/upload');
const itemController   = require('../controllers/itemController');

// ─── Public Routes ───────────────────────────────────────────────
router.get('/', itemController.getItems);

// ⚠️ قبل '/:id' دائماً
router.get('/user/my-items',    auth, itemController.getMyItems);
router.get('/pending-rating',   auth, itemController.getPendingRating);

// GET single item — optionalAuth بدل jwt.verify في Controller
router.get('/:id', validateObjectId, optionalAuth, itemController.getItemById);

// ─── Protected — Level 1+ ────────────────────────────────────────
router.post('/', auth, upload.single('image'), itemController.createItem);

router.put('/:id',
  validateObjectId,
  auth,
  upload.single('image'),
  itemController.updateItem
);

router.delete('/:id', validateObjectId, auth, itemController.deleteItem);

// ─── Report — للطرفين بعد التسليم ────────────────────────────────
router.post('/report', auth, itemController.reportUser);

// ─── Protected — Level 2+ ────────────────────────────────────────
router.put('/book/:id',     validateObjectId, auth, requireLevel2, itemController.bookItem);
router.put('/cancel/:id',   validateObjectId, auth, itemController.cancelBooking);
router.put('/complete/:id', validateObjectId, auth, itemController.completeDelivery);

// تقييم المتبرع (من المستلم)
router.put('/rate/:id',          validateObjectId, auth, itemController.rateItem);
// تقييم المستلم (من المتبرع) — endpoint جديد
router.put('/rate-receiver/:id', validateObjectId, auth, itemController.rateReceiver);

module.exports = router;
