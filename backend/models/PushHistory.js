const mongoose = require('mongoose');

const pushHistorySchema = new mongoose.Schema({
    title: { type: String, required: true },
    body: { type: String, required: true },
    targetUrl: { type: String },
    successCount: { type: Number, default: 0 },
    adminUsername: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('PushHistory', pushHistorySchema);