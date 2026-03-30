const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. إعداد حساب الجيميل اللي رح نبعت منه
 const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    // 🟢 الضربة القاضية: إجبار السيرفر على استخدام شبكة IPv4 المدعومة
    family: 4 
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