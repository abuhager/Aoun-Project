const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const initCronJobs = require('./utils/cronJobs'); // 🟢 استيراد الوظيفة
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// الاتصال بالداتا بيز
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ تم الاتصال بقاعدة البيانات MongoDB بنجاح!');
    initCronJobs(); // 🟢 تشغيل المهام المجدولة بعد التأكد من اتصال الداتا بيز
  })
  .catch((err) => console.log('❌ خطأ في الاتصال:', err.message));

app.get('/', (req, res) => {
  res.send('سيرفر منصة عون شغال ومربوط بالداتا بيز! 🚀');
});

const PORT = process.env.PORT || 5000;
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});