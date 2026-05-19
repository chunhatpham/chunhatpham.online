const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    referenceCode: { type: String, required: true, unique: true }, // Mã giao dịch ngân hàng (Mã tham chiếu)
    contact: { type: String, required: true }, // Tài khoản/SĐT của người nạp
    amount: { type: Number, required: true }, // Số tiền nạp
    content: { type: String, required: true }, // Nội dung chuyển khoản
    status: { type: String, default: 'success' } // Trạng thái
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);