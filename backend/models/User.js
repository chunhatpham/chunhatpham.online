const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true }, // Số điện thoại
    email: { type: String, required: true, unique: true }, // Địa chỉ Email
    username: { type: String, required: true, unique: true }, // Tên hiển thị
    password: { type: String, required: true }, // Sẽ được mã hóa bảo mật
    walletBalance: { type: Number, default: 0 }, // Số dư tiền thật (mặc định là 0đ)
    isPremium: { type: Boolean, default: false }, // Có phải VIP không
    premiumTier: { type: String, default: 'none' }, // Cấp bậc VIP: 'none', 'bronze', 'silver', 'gold', 'diamond'
    premiumExpiry: { type: Date }, // Ngày hết hạn gói Premium
    noAdsExpiry: { type: Date }, // Thời hạn gói Tắt Quảng Cáo (dành cho user thường)
    role: { type: String, default: 'user' }, // Quyền: 'user' hoặc 'admin'
    resetPasswordOtp: { type: String }, // Mã OTP dùng để khôi phục mật khẩu
    resetPasswordExpires: { type: Date }, // Thời gian mã OTP hết hạn
    dailyMsgCount: { type: Number, default: 0 }, // Đếm số tin nhắn đã gửi trong ngày
    lastMsgDate: { type: Date } // Đánh dấu ngày gửi tin nhắn cuối cùng để reset
}, { timestamps: true }); // Tự động lưu thời gian tạo tài khoản

module.exports = mongoose.model('User', userSchema);