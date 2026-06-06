const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    username: { type: String, required: true }, // Tài khoản đã đăng ký
    endpoint: { type: String, required: true, unique: true }, // Điểm cuối của Google/Apple
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
    }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);