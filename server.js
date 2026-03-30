const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const initCronJobs = require('./utils/cronJobs'); 
require('dotenv').config();

const app = express();

// 🟢 1. إعدادات CORS الاحترافية (حطها أول إشي)
app.use(cors({
    origin: '*', // بيسمح لكل المواقع، بتقدر تستبدله برابط الـ Vercel تبعك للأمان أكثر
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// 🟢 2. معالجة الـ JSON (ضروري يكون قبل الـ Routes)
app.use(express.json());

// الاتصال بالداتا بيز
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ تم الاتصال بقاعدة البيانات MongoDB بنجاح!');
    initCronJobs(); 
  })
  .catch((err) => console.log('❌ خطأ في الاتصال:', err.message));

// 🟢 3. ترتيب المسارات (Routes) بشكل صحيح
// خلي المسار الرئيسي شغال للفحص
app.get('/', (req, res) => {
  res.send('سيرفر منصة عون شغال ومربوط بالداتا بيز! 🚀');
});

// تعريف مسارات الـ API بعد الـ Middleware
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});