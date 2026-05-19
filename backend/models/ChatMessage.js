const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    username: { type: String, required: true },
    content: { type: String }, 
    image: { type: String }, // Ảnh đính kèm (Dành cho Admin)
    role: { type: String, default: 'user' },
    isPremium: { type: Boolean, default: false },
    premiumTier: { type: String, default: 'none' },
    replyTo: {
        msgId: String,
        username: String,
        content: String
    },
    reactions: [{
        emoji: String,
        username: String
    }],
    isDeleted: { type: Boolean, default: false }, // Đánh dấu thu hồi
    isPinned: { type: Boolean, default: false } // Đánh dấu Ghim tin nhắn
}, { 
    timestamps: true 
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);