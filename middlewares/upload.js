const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. إعطاء السيرفر مفاتيح الخزنة (تأكد إن الحروف كابيتال في الـ .env على Render)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. إعدادات التخزين مع تحسين تلقائي للصور
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'aoun_items', 
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp'], // 🟢 تعديل بسيط: CamelCase أدق للنسخة v4
        transformation: [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto' }] 
    },
});

// 3. تجهيز العتّال (Multer) مع حماية لحجم الملف
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // حماية: أقصى حجم 5 ميجا بايت
});

module.exports = upload;