const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    // 1. جلب التوكن من الـ Header (الرسالة اللي جاية من Postman أو الـ Frontend)
    const token = req.header('x-auth-token');

    // 2. إذا التوكن مش موجود (يعني اليوزر مش مسجل دخول)
    if (!token) {
        return res.status(401).json({ msg: 'لا يوجد توكن، الدخول مرفوض 🛑' });
    }

    try {
        // 3. فك التشفير والتأكد إنو التوكن حقيقي وموقع بالـ Secret تبعنا
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. إذا التوكن صح، بنسحب بيانات اليوزر (الـ ID والصلاحية) وبنلزقها بالطلب
        req.user = decoded.user;
        
        // 5. افتح الباب وخليه يكمل طريقه للمسار اللي كان رايحله (زي إضافة غرض)
        next(); 
    } catch (err) {
        // إذا التوكن ملعوب فيه أو منتهي الصلاحية
        res.status(401).json({ msg: 'التوكن غير صالح أو منتهي الصلاحية ⚠️' });
    }
};