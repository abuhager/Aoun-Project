const User = require('../models/User');

exports.findByEmail = (email) => {
    return User.findOne({ email });
};

exports.findByEmailWithPassword = (email) => {
    return User.findOne({ email }).select('+password');
};

exports.findById = (id) => {
    return User.findById(id).select('-password -__v');
};

exports.findByResetToken = (hashedToken) => {
    return User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: Date.now() }
    }).select('+password');
};

exports.createUser = (data) => {
    const user = new User(data);
    return user.save();
};

exports.saveUser = (user) => {
    return user.save();
};