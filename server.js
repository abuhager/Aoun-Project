const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { globalLimiter } = require('./middlewares/rateLimiter');
app.use('/api/', globalLimiter);
const cors = require('cors');
const initCronJobs = require('./utils/cronJobs'); 
require('dotenv').config();

const app = express();

// 🟢 1. إعداد الـ CORS بشكل احترافي لدعم اللوكال والموقع المرفوع
const allowedOrigins = [
    'http://localhost:3000', 
    'https://aoun-project-front-end-dk76.vercel.app',
    'https://aoun-project-front-end.vercel.app'
];

app.use(cors({
    origin: function (origin, callback) {
        // فحص ذكي: يسمح للوكال، القائمة، وأي رابط فرعي لمشروعك على فيرسيل
        const isVercel = origin && origin.includes('aoun-project') && origin.endsWith('.vercel.app');
        
        if (!origin || allowedOrigins.includes(origin) || isVercel) {
            callback(null, true);
        } else {
            // طباعة الرابط المرفوض عشان تعرفه من الـ Logs
            console.log("🚫 CORS Blocked for origin:", origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Accept'],
    credentials: true 
}));

app.use(express.json({ limit: '10mb' }));

// 🟢 2. رادار لمراقبة الطلبات في الـ Logs
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