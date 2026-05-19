const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    targetUsername: { type: String, required: true }, // Gửi cho ai
    title: { type: String, required: true }, // Tiêu đề thông báo
    message: { type: String, required: true }, // Nội dung
    isRead: { type: Boolean, default: false } // Đã đọc chưa
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);