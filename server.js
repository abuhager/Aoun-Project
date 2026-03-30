const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const initCronJobs = require('./utils/cronJobs'); 
require('dotenv').config();

const app = express();

// 🟢 1. الحقن اليدوي للهيدرز (Manual CORS) - هاد أقوى من المكتبة
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://aoun-project-front-end-dk76.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // إذا كان الطلب من نوع OPTIONS (فحص النبض)، بنرد فوراً بـ 200 وبننهي الطلب
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// 🟢 2. تفعيل المكتبة كزيادة أمان
app.use(cors()); 

app.use(express.json({ limit: '10mb' }));

// رادار لمراقبة الطلبات في الـ Logs
app.use((req, res, next) => {
    console.log(`📡 Request: ${req.method} ${req.url}`);
    next();
});

// الاتصال بالداتا بيز
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    initCronJobs(); 
  })
  .catch((err) => console.log('❌ DB Error:', err.message));

app.get('/', (req, res) => res.send('Aoun Server is Live! 🚀'));

// المسارات
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));

// 🟢 3. معالج أخطاء عام (عشان السيرفر ما يضرب كراش ويعطي 502)
app.use((err, req, res, next) => {
    console.error("🔥 Global Error Handler:", err.stack);
    res.status(500).json({ message: "حدث خطأ داخلي في السيرفر", error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port: ${PORT}`);
});