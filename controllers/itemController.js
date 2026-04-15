// controllers/itemController.js
const itemService = require('../services/itemService');
const { validateCreateItem } = require('../dtos/itemDto');

// 1. جلب كل التبرعات مع Pagination

exports.getItems = async (req, res) => {
    try {
        const result = await itemService.getItemsLogic(req.query);
        res.json(result); // بترجع items, total, page, pages
    } catch (err) {
        console.error("Pagination Error:", err.message);
        res.status(500).json({ msg: 'خطأ في السيرفر أثناء جلب الأغراض' });
    }
};
exports.getMyItems = async (req, res) => {
    try {
        // نستخدم id أو _id لضمان استخراج المعرف من التوكن
        const userId = req.user.id || req.user._id;
        
        // استدعاء الخدمة (Service) التي تتعامل مع البيانات
        const result = await itemService.getMyItemsLogic(userId);
        
        res.json(result);
    } catch (err) {
        console.error("🔥 Error in getMyItems Controller:", err.message); 
        res.status(500).json({ msg: 'خطأ في السيرفر أثناء جلب بياناتي' });
    }
};
exports.getItemById = async (req, res) => {
    try {
        let requesterId = null;
        const authHeader = req.header('x-auth-token');

        // قراءة التوكن يدوياً لأنه مسار عام (Public Route) بس بدنا نعرف مين الي فات
        if (authHeader) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(authHeader, process.env.JWT_SECRET);
                // هون كان في مشكلة بكودك القديم، رح نضبطها هيك:
                requesterId = decoded.user.id || decoded.user._id; 
            } catch (error) { 
                // توكن خربان أو منتهي، بنتجاهله وبنعتبره زائر عادي
            }
        }

        const result = await itemService.getItemByIdLogic(req.params.id, requesterId);
        res.json(result);
    } catch (err) {
        const status = err.message === 'الغرض غير موجود' ? 404 : 500;
        res.status(status).json({ msg: err.message || 'خطأ في السيرفر' });
    }
};

// 4. إضافة غرض
exports.createItem = async (req, res) => {
  try {
    const { error } = validateCreateItem(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    console.log('🔍 req.user in createItem:', req.user);  // ← سطر مهم

    const userId = req.user.id || req.user._id;
    console.log('🔍 userId passed to service:', userId);   // ← سطر مهم

    const result = await itemService.createItemLogic(req.body, userId, req.file);

    res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// 5. حجز غرض

exports.bookItem = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;   // ✅ نفس النمط اللي استخدمناه في createItem

    const result = await itemService.bookItemLogic(req.params.id, userId);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};



exports.cancelBooking = async (req, res) => {
    try {
        const result = await itemService.cancelBookingLogic(req.params.id, req.user.id.toString());
        res.json(result);
    } catch (err) {
        const status = ['الغرض غير موجود'].includes(err.message) ? 404 : ['غير مصرح لك'].includes(err.message) ? 401 : 500;
        res.status(status).json({ msg: err.message || 'خطأ في السيرفر' });
    }
};

exports.completeDelivery = async (req, res) => {
    try {
        const result = await itemService.completeDeliveryLogic(req.params.id, req.user.id, req.body.otp);
        res.json(result);
    } catch (err) {
        res.status(400).json({ msg: err.message || 'خطأ في التسليم' });
    }
};

exports.rateItem = async (req, res) => {
    try {
        const result = await itemService.rateItemLogic(req.params.id, req.user.id, req.body.rating);
        res.json(result);
    } catch (err) {
        res.status(400).json({ msg: err.message || 'خطأ في التقييم' });
    }
};

exports.reportUser = async (req, res) => {
    try {
        const result = await itemService.reportUserLogic(req.body.reportedUserId, req.user.id.toString());
        res.json(result);
    } catch (err) {
        res.status(400).json({ msg: err.message || 'خطأ في البلاغ' });
    }
};

exports.updateItem = async (req, res) => {
    try {
        const result = await itemService.updateItemLogic(req.params.id, req.user.id, req.body, req.file);
        res.json(result);
    } catch (err) {
        res.status(404).json({ msg: err.message || 'فشل التعديل' });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const result = await itemService.deleteItemLogic(req.params.id, req.user.id, req.user.role);
        res.json(result);
    } catch (err) {
        res.status(401).json({ msg: err.message || 'خطأ في الحذف' });
    }
};