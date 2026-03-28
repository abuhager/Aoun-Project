const express = require('express');
const mongoose = require('mongoose'); // ضفنا المترجم هون
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// كود الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات MongoDB بنجاح!'))
  .catch((err) => console.log('❌ خطأ في الاتصال:', err.message));

// مسار الفحص
app.get('/', (req, res) => {
  res.send('سيرفر منصة عون شغال ومربوط بالداتا بيز! 🚀');
});

const PORT = process.env.PORT || 5000;
app.use('/api/auth', require('./routes/auth'));
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});