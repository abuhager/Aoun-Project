const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. إعداد حساب الجيميل اللي رح نبعت منه
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // إيميلك إنت (إيميل المنصة)
      pass: process.env.EMAIL_PASS  // باسورد التطبيقات (رح أشرحلك إياه)
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