const mongoose = require('mongoose');

// Cấu trúc cho 1 Tập phim
const episodeSchema = new mongoose.Schema({
    episodeNumber: { type: Number, required: true },
    title: { type: String, required: true },
    audioUrl: { type: String },
    videoUrl: { type: String },
    isPremium: { type: Boolean, default: false } // Tập này có yêu cầu VIP không?
});

// Cấu trúc cho 1 Phần phim (Season)
const seasonSchema = new mongoose.Schema({
    seasonNumber: { type: Number, default: 1 },
    seasonName: { type: String, default: "Phần 1" },
    episodes: [episodeSchema]
});

// Cấu trúc tổng thể của 1 Bộ Phim
const movieSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true }, // Mã định danh URL (VD: hoa-khoi-da-co-em-be)
    title: { type: String, required: true },
    coverImg: { type: String, required: true },
    tag: { type: String, default: 'NEW' },
    description: { type: String },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    uploadOrder: { type: Number, default: Date.now }, // Timestamp để phim mới đẩy lên đầu
    seasons: [seasonSchema]
}, { timestamps: true });

module.exports = mongoose.model('Movie', movieSchema);