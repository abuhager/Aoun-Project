// routes/items.js
// ============================================================
// ✅ PHASE 1 — UPDATED
// ~ GET /:id         — optionalAuth (بدل jwt مباشر في Controller)
// + validateObjectId — على كل route تحتوي :id
// ~ PUT /book/:id    — أضيف requireLevel2
// ============================================================
const express          = require('express');
const router           = express.Router();
const auth             = require('../middlewares/auth');
const optionalAuth     = require('../middlewares/optionalAuth');
const requireLevel2    = require('../middlewares/requireLevel2');
const validateObjectId = require('../middlewares/validateObjectId');
const itemController   = require('../controllers/itemController');

router.get('/',    itemController.getAllItems);

router.get('/:id',
  validateObjectId,
  optionalAuth,
  itemController.getItemById
);

router.post('/',   auth, itemController.createItem);

router.put('/:id',
  validateObjectId, auth, itemController.updateItem
);

router.delete('/:id',
  validateObjectId, auth, itemController.deleteItem
);

router.get('/user/my-items', auth, itemController.getMyItems);

// Level 2 فقط
router.put('/book/:id',
  validateObjectId, auth, requireLevel2, itemController.bookItem
);

router.put('/cancel/:id',
  validateObjectId, auth, itemController.cancelBooking
);

router.put('/complete/:id',
  validateObjectId, auth, itemController.completeDelivery
);

router.put('/rate/:id',
  validateObjectId, auth, itemController.rateItem
);

router.post('/report', auth, itemController.reportUser);

module.exports = router;
