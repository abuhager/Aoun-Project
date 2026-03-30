const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. إعداد حساب الجيميل اللي رح نبعت منه
 const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // 🟢 تحديد السيرفر مباشرة بدل service
    port: 465,              // 🟢 استخدام البورت الآمن
    secure: true,           // 🟢 تفعيل الحماية
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // 🟢 تجاوز تدقيق السيرفرات السحابية
    }
});

  // 2. تجهيز محتوى الرسالة
  const mailOptions = {
    from: 'منصة عون المجتمعية <no-reply@aoun.com>',
    to: options.email,
    subject: options.subject,
    html: options.message // بنستخدم HTML عشان الرسالة تطلع فخمة
  };

  // 3. إرسال الرسالة
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;