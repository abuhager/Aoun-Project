// routes/items.js
// ============================================================
// ✅ PHASE 1 — FIXED: getAllItems → getItems
// تم مطابقة أسماء exports مع itemController.js
// ============================================================
const express          = require('express');
const router           = express.Router();
const auth             = require('../middlewares/auth');
const optionalAuth     = require('../middlewares/optionalAuth');
const requireLevel2    = require('../middlewares/requireLevel2');
const validateObjectId = require('../middlewares/validateObjectId');
const itemController   = require('../controllers/itemController');

// ─── Public Routes ────────────────────────────────────────────
router.get('/', itemController.getItems);

// ⚠️ مهم: هذا الـ route جب يكون قبل '/:id' لتجنب conflict
router.get('/user/my-items',
  auth,
  itemController.getMyItems
);

router.get('/pending-rating',
  auth,
  itemController.getPendingRating
);

// GET single item - optionalAuth بدل jwt.verify في Controller
router.get('/:id',
  validateObjectId,
  optionalAuth,
  itemController.getItemById
);

// ─── Protected — Level 1+ (Email Verified) ──────────────────
router.post('/',
  auth,
  itemController.createItem
);

router.put('/:id',
  validateObjectId,
  auth,
  itemController.updateItem
);

router.delete('/:id',
  validateObjectId,
  auth,
  itemController.deleteItem
);

router.post('/report',
  auth,
  itemController.reportUser
);

// ─── Protected — Level 2+ (Verified + WhatsApp or University) ───
router.put('/book/:id',
  validateObjectId,
  auth,
  requireLevel2,
  itemController.bookItem
);

router.put('/cancel/:id',
  validateObjectId,
  auth,
  itemController.cancelBooking
);

router.put('/complete/:id',
  validateObjectId,
  auth,
  itemController.completeDelivery
);

router.put('/rate/:id',
  validateObjectId,
  auth,
  itemController.rateItem
);

module.exports = router;
