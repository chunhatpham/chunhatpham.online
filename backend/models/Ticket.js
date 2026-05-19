const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    username: { type: String, required: true }, // Nick gửi hỗ trợ
    name: { type: String, required: true }, // Tên người gửi
    email: { type: String, required: true }, // Email liên hệ
    content: { type: String, required: true }, // Nội dung
    image: { type: String }, // Ảnh đính kèm (Lưu dạng Base64)
    status: { type: String, default: 'pending' }, // pending (Chờ xử lý), replied (Đã trả lời)
    replyContent: { type: String } // Nội dung Admin trả lời
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);