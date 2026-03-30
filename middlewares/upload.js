const multer = require('multer');

// 🟢 تخزين مؤقت في الذاكرة (Memory) بدل الكلاوديناري المباشر
// هاد الحل مستحيل يعطيك "is not a constructor"
const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

module.exports = upload;