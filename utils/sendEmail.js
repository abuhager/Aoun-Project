// 🟢 تم استبدال nodemailer بـ native fetch (ما بنحتاج مكتبات خارجية)
const sendEmail = async (options) => {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY, // 🔴 تأكد إنك ضفت هذا المفتاح في Render
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { 
            name: 'منصة عون المجتمعية', 
            email: 'aoun.help.center@gmail.com' // الإيميل اللي وثقته في Brevo
        },
        to: [{ email: options.email }],
        subject: options.subject,
        htmlContent: options.message // Brevo بيستخدم htmlContent بدل html
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ فشل إرسال الإيميل عبر Brevo:", errorData);
      throw new Error("خطأ في مزود خدمة الإيميل");
    }

    console.log("✅ تم إرسال الإيميل بنجاح عبر Brevo API!");
  } catch (error) {
    console.error("❌ Error in sendEmail utility:", error.message);
    throw error;
  }
};

module.exports = sendEmail;