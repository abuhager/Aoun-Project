const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. إعطاء السيرفر مفاتيح الخزنة من ملف .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. إعدادات التخزين (المجلد والصيغ المسموحة)
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'aoun_items', // Cloudinary رح يعمل مجلد بهاد الاسم ويحط صورك فيه
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], // حماية: بس نقبل صور
    },
});

// 3. تجهيز "العتّال" اللي رح نستخدمه بالراوتس
const upload = multer({ storage: storage });

module.exports = upload;