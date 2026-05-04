const express      = require('express');
const mongoose     = require('mongoose');
const cors         = require('cors');
const helmet       = require('helmet');                          // ✅ جديد
const { globalLimiter } = require('./middlewares/rateLimiter');
const initCronJobs = require('./utils/cronJobs');
require('dotenv').config();

// 1. تعريف السيرفر
const app = express();

// ✅ جديد — helmet يضيف ~14 HTTP security header دفعةً واحدة
app.use(helmet());

// 2. الجدار الناري للـ API
app.use('/api/', globalLimiter);

// 3. إعداد CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://aoun-project-front-end-dk76.vercel.app',
  'https://aoun-project-front-end.vercel.app',
];

app.use(cors({
  origin: function (origin, callback) {
    const isVercel = origin && origin.includes('aoun-project') && origin.endsWith('.vercel.app');
    if (!origin || allowedOrigins.includes(origin) || isVercel) {
      callback(null, true);
    } else {
      console.log("🚫 CORS Blocked for origin:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Accept'],
  credentials:    true,
}));

app.use(express.json({ limit: '10mb' }));

// 4. رادار الطلبات
app.use((req, res, next) => {
  console.log(`📡 Request: ${req.method} ${req.url}`);
  next();
});

// ✅ جديد — /health endpoint للمراقبة وللتحقق أن السيرفر حي
app.get('/health', (req, res) => {
  res.status(200).json({
    status:    'ok',
    uptime:    process.uptime(),
    timestamp: new Date().toISOString(),
    db:        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
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
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/items', require('./routes/items'));

// 5. معالج الأخطاء العام
app.use((err, req, res, next) => {
  console.error("🔥 Global Error Handler:", err.stack);
  res.status(500).json({ message: "حدث خطأ داخلي في السيرفر", error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port: ${PORT}`);
});