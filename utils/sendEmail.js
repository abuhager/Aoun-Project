const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. إعداد حساب الجيميل اللي رح نبعت منه
 const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    // 🟢 السطرين السحريات اللي بيحلوا مشكلة Render و Google
    tls: {
        rejectUnauthorized: false 
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