const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); // Thêm thư viện gửi Email
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Ticket = require('./models/Ticket'); // Model Hỗ trợ
const Notification = require('./models/Notification'); // Model Thông báo
const ChatMessage = require('./models/ChatMessage'); // Model Chat
const Movie = require('./models/Movie'); // Model Phim Siêu Cấp
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Tăng giới hạn payload lên 10MB để nhận ảnh Base64

// BỘ BẢO VỆ: Bắt các lỗi ngầm làm sập Server và in ra màn hình
process.on('uncaughtException', (err) => {
    console.error('\n🔴 [LỖI HỆ THỐNG LÀM SẬP SERVER]:', err.message, '\n👉 Gợi ý: Hãy kiểm tra xem bạn đã cài đủ thư viện chưa (ví dụ: npm install nodemailer), hoặc có cửa sổ Terminal nào đang chạy trùng cổng 5000 không.\n');
});

// CẤU HÌNH HỆ THỐNG GỬI EMAIL TỰ ĐỘNG (Dùng Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'changdinhanh@gmail.com', // Thay bằng Gmail của bạn
        pass: process.env.EMAIL_PASS || 'qhkgxdbglzzcwdex'        // Mật khẩu ứng dụng Gmail của bạn
    }
});

// ==========================================
// 1. KẾT NỐI DATABASE (MONGODB)
// ==========================================
// Thêm fallback đường dẫn local nếu bạn chưa tạo file .env
const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chunhatpham';

mongoose.connect(dbURI)
    .then(async () => {
        console.log('🟢 Đã kết nối thành công với Cơ Sở Dữ Liệu MongoDB!');
        
        // TỰ ĐỘNG DỌN DẸP LỖI E11000 (TRÙNG LẶP DỮ LIỆU ẢO CỦA MONGODB)
        try {
            await User.deleteMany({ $or: [ { phone: null }, { email: null }, { phone: "" }, { email: "" }, { phone: { $exists: false } } ] }); // Xóa sạch tài khoản rác bị lỗi rỗng
            await User.collection.dropIndexes();
            await User.syncIndexes();
            console.log('✅ Đã dọn dẹp các ràng buộc cũ, khắc phục triệt để lỗi Đăng Ký E11000!');
        } catch(e) { console.log('Bỏ qua dọn dẹp Index:', e.message); }

        // TỰ ĐỘNG TẠO TÀI KHOẢN ADMIN MẶC ĐỊNH NẾU CHƯA CÓ
        try {
            let adminUser = await User.findOne({ username: 'chunhatpham_admin' });
            
            if (adminUser) {
                // Tài khoản đã tồn tại, cập nhật quyền
                adminUser.role = 'admin';
                adminUser.walletBalance = 99999999;
                adminUser.isPremium = true;
                adminUser.premiumTier = 'diamond';
                await adminUser.save();
                console.log('👑 ĐÃ KHÔI PHỤC QUYỀN ADMIN: [chunhatpham_admin]');
            } else {
                const salt = await bcrypt.genSalt(10);
                const hashedAdminPassword = await bcrypt.hash('Admin@123456', salt); // Mật khẩu mặc định
                
                // Xóa các tài khoản rác (nếu có) đang chiếm dụng số điện thoại hoặc email của Admin
                await User.deleteMany({ $or: [{ phone: '0999999999' }, { email: 'admin_master@chunhatpham.online' }] });

                adminUser = new User({
                    phone: '0999999999',
                    email: 'admin_master@chunhatpham.online',
                    username: 'chunhatpham_admin',
                    password: hashedAdminPassword,
                    walletBalance: 99999999, role: 'admin', isPremium: true, premiumTier: 'diamond'
                });
                await adminUser.save();
                console.log('👑 ĐÃ TẠO ADMIN BÍ MẬT: [Tài khoản: chunhatpham_admin | Mật khẩu: Admin@123456]');
            }
        } catch (e) { console.log('🔴 Lỗi tạo/cập nhật admin:', e.message); }

        // ĐỒNG BỘ PHIM TỪ THƯ MỤC LÊN DATABASE
        try {
            const moviesDir = path.join(__dirname, 'movies_data');
            if (!fs.existsSync(moviesDir)) fs.mkdirSync(moviesDir);
            
            // KIỂM TRA XEM DỮ LIỆU TRONG DATABASE CÓ ĐANG BỊ LỘN XỘN KHÔNG
            const checkMovie = await Movie.findOne({ slug: 'hoa-khoi-da-co-em-be' });
            
            // Nếu dữ liệu bị lỗi mốc thời gian (nhỏ hơn 1.6 tỷ tỷ), hệ thống sẽ TỰ ĐỘNG DỌN DẸP
            if (!checkMovie || !checkMovie.uploadOrder || checkMovie.uploadOrder < 1600000000000) {
                console.log("🛠️ PHÁT HIỆN DỮ LIỆU PHIM ĐANG BỊ LỘN XỘN -> ĐANG TỰ ĐỘNG DỌN SẠCH VÀ SẮP XẾP LẠI...");
                
                // Xóa sạch Database và Thư mục cũ để làm lại từ đầu
                await Movie.deleteMany({});
                if (fs.existsSync(moviesDir)) { fs.rmSync(moviesDir, { recursive: true, force: true }); }
                fs.mkdirSync(moviesDir);

                const oldMovies = [
                    ["Tôi Muốn Ly Hôn Với Đại Lão", "https://i.postimg.cc/wx2293SM/69AACA28-C240-441A-84EC-3F04FDFDDA96.jpg", "https://videotourl.com/audio/1779192701252-a875996f-f6ea-47f2-ac5a-b41d6fa690f2.m4a"],
                    ["Hoa Khôi Đã Có Em Bé", "https://i.postimg.cc/N0WZjw82/AD04FE19-D35B-4A4E-A3DE-357D0DA452DE.jpg", "https://videotourl.com/audio/1779002003624-511d1962-2a5f-4662-8950-4727cecf00cb.m4a"],
                    ["Điều Bí Ẩn Trong Truyền Thuyết", "https://i.postimg.cc/zf94G1wG/gen.jpg", "https://videotourl.com/audio/1779001858015-891b7581-070f-446e-aa3a-d2a5b2ea4d0c.m4a"],
                    ["Bạn Gái Gửi Nhờ Con Gái", "https://i.postimg.cc/fLRQ1f9y/7FDE2678-506D-4184-BEED-A353F46768D6.jpg", "https://videotourl.com/audio/1778912532488-dbd61604-387a-4da9-ab25-2abec9ea9072.m4a"],
                    ["Vợ Của Tôi Mắc Bệnh", "https://i.postimg.cc/7LVyBWf7/gen.jpg", "https://videotourl.com/audio/1778912384799-73c55bde-b0f0-4bcd-9ac0-d3fc0170c138.m4a"],
                    ["Tôi Từ Bỏ Chị Mình", "https://i.postimg.cc/g2KZwWD7/810E7C4C-7B02-41A1-B161-24547A2AEAB9.jpg", "https://videotourl.com/audio/1778820581886-8c11a88b-7f40-48c8-9b0c-93ddb7b8e7a8.m4a"],
                    ["Bạn Gái Là Do Tôi Nhặt Được", "https://i.postimg.cc/V6M5xw31/gen.jpg"], ["Tôi Được Đưa Đến Cạnh Em", "https://i.postimg.cc/RFT72kJQ/gen.jpg"],
                    ["Cứu Được Hoa Khôi Trường", "https://i.postimg.cc/8cPRGZLf/gen.jpg"], ["Đồ Quý Giá Của Tiểu Thư", "https://i.postimg.cc/CdpzJpyp/gen.jpg"],
                    ["Bám Lấy Bạn Gái Xã Hội", "https://i.postimg.cc/pdBNLxc7/IMG-1655.jpg"], ["Mẹ Tìm Người Dám Sát Tôi", "https://i.postimg.cc/fbv4RZqp/gen.jpg"],
                    ["Đại Tiểu Thư Không Yêu Tôi", "https://i.postimg.cc/KYMq1Xgy/gen.jpg"], ["Bố Giúp Tôi Lấy Con Gái Của Bạn", "https://i.postimg.cc/MGQPnkjJ/gen.jpg"],
                    ["Hoa Khôi Quá Bám Tôi", "https://i.postimg.cc/MGQPnkj2/gen.jpg"], ["Tôi Kéo Được Tình Yêu Nhưng", "https://i.postimg.cc/7LNWXzDP/gen.jpg"],
                    ["Mập Mờ Với Con Thầy Giáo", "https://i.postimg.cc/3RcFxzy5/C401AC14-4C58-4E6B-936B-273E1C8A0DF7.jpg"], ["Nghi Ngờ Bạn Gái Trọng Sinh", "https://i.postimg.cc/zBcFG4y9/gen.jpg"],
                    ["Bạn Gái Tôi Xinh Nhất", "https://i.postimg.cc/fLrfR1V1/IMG-1499.jpg"], ["Cô Bạn Gái Nói Dối Tôi", "https://i.postimg.cc/PfS6rWWq/gen.jpg"],
                    ["Chuyến Tàu Đầy Định Mệnh", "https://i.postimg.cc/tgmSDC8p/gen.jpg"], ["Tôi Đã Quên Vị Hôn Thê", "https://i.postimg.cc/8CnKwPxD/gen.jpg"],
                    ["Hoa Khôi Mất Thính Lực", "https://i.postimg.cc/NFqGs98m/gen.jpg"], ["Bạn Gái Cố Tình Làm Tôi Ghen", "https://i.postimg.cc/kG3MJ6NW/gen.jpg"],
                    ["Cô Gái Tôi Cứu Ép Buộc Tôi", "https://i.postimg.cc/13SQWBBb/27116ED2-8973-4FCD-86A9-70C61DBAFCA6.jpg"], ["Quay Trở Lại Nhà Mình", "https://i.postimg.cc/Sx4hZddv/gen.jpg"],
                    ["Xem Bói Giúp Nữ Tổng Tài", "https://i.postimg.cc/52JVPggK/gen.jpg"], ["Anh Ấy Bỏ Tôi Mà Đi", "https://i.postimg.cc/sgr7QXbw/gen.jpg"],
                    ["Em Bị Vào Tròng Rồi", "https://i.postimg.cc/0jmKG3Fy/gen.jpg"], ["Bố Tôi Trả Góp Ô Tô", "https://i.postimg.cc/kGz4QNmj/gen.jpg"],
                    ["Bài Kiểm Tra Của Thanh Mai", "https://i.postimg.cc/TwB0MTxx/gen.jpg"], ["Mẹ Ra Lệnh Cho Tôi", "https://i.postimg.cc/bN61yP2W/gen.jpg"],
                    ["Bố Và Mẹ Của Tôi Nhất", "https://i.postimg.cc/Cxsf18z0/gen.jpg"], ["Tôi Là Phản Diện Mạnh Nhất", "https://i.postimg.cc/Gpc0d9pS/gen.jpg"],
                    ["Bỏ Vợ Và Ra Đi", "https://i.postimg.cc/yxy5Thng/gen.jpg"], ["Người Yêu Ngày Cha Qua Đời", "https://i.postimg.cc/63MWv0rs/gen.jpg"],
                    ["Chặn Đầu Xe Ô Tô", "https://i.postimg.cc/bJH695MW/gen.jpg"], ["Chân Sai Vặt Của Họ", "https://i.postimg.cc/5097CBbV/gen.jpg"],
                    ["Bạn Thân Người Yêu Cũ", "https://i.postimg.cc/kgbw1Xmc/gen.jpg"], ["Hoán Đổi Thân Thế Rồi", "https://i.postimg.cc/6q3LbhX2/gen.jpg"],
                    ["Tôi Buổi Tối Hôm Đấy", "https://i.postimg.cc/mhf9n6PN/gen.jpg"], ["Ra Đi Để Giữ Lại", "https://i.postimg.cc/MTxRrjgG/gen.jpg"],
                    ["Sự Kiện Cho Đàn Ông", "https://i.postimg.cc/x1C3Q5ms/gen.jpg"], ["Tôi Kháng Lại Tất Cả", "https://i.postimg.cc/y8dyKjRR/IMG_0690.jpg"],
                    ["Hoa Khôi Cố Gắng Tìm", "https://i.postimg.cc/t4TNbk65/gen.jpg"], ["Người Cuồng Em Trai Nhất", "https://i.postimg.cc/QCj14wm3/gen.jpg"],
                    ["Chị Gái Của Tôi Mà", "https://i.postimg.cc/Vv4M3gZz/DEAAFC7F_55EF_416F_995D_A22803B5A23F.jpg"], ["Vợ Tôi Lạnh Lùng Quá", "https://i.postimg.cc/RC7y5zTy/54CEAEE5_2DA5_4922_BFEF_8BC1069C950B.jpg"],
                    ["Ngày Bạn Gái Rời Đi", "https://i.postimg.cc/SQ63FpG5/gen.jpg"], ["Người Bố Chức Bí Mật", "https://i.postimg.cc/SNCpCqdh/gen.jpg"],
                    ["Các Chị Gái Của Tôi", "https://i.postimg.cc/fTmhmZCh/IMG_0555.jpg"], ["Hình Mẫu Của Tôi Đấy", "https://i.postimg.cc/15W5bPn3/gen.jpg"],
                    ["Gặp Gỡ Với Hoa Khôi", "https://i.postimg.cc/SNZNHq2N/IMG_0511.jpg"], ["Rời Xa Khỏi Vợ Mình", "https://i.postimg.cc/zvKPLnW8/IMG_0409.jpg"],
                    ["Ngày Đầu Tôi Trở Về Nhà", "https://i.postimg.cc/MHVrcyRW/gen.jpg"], ["Cô Gái Tìm Kiếm Tôi", "https://i.postimg.cc/0Nx0h3NT/gen.jpg"],
                    ["Tôi Là Nỗi Sợ Hãi", "https://i.postimg.cc/8P6dThq6/IMG-0321.jpg"], ["Lời Dạy Bảo Của Mẹ", "https://i.postimg.cc/qvB71rXH/gen.jpg"],
                    ["Bạn Thân Của Chị Gái", "https://i.postimg.cc/nhVL3xKW/IMG_0320.jpg"], ["Tôi Trở Thành Tỉ Phú", "https://i.postimg.cc/P5Z9MP5W/gen.jpg"],
                    ["Ba Em Gái Của Tôi", "https://i.postimg.cc/wvbm8gXT/gen.jpg"], ["Bạn Gái Cũ Chứng Minh", "https://i.postimg.cc/qRZ3V4s4/IMG_0223.jpg"],
                    ["Tôi Cố Gắng Chịu Đựng", "https://i.postimg.cc/FK96b6vH/gen.jpg"], ["Bài Mới Của Bạn Gái", "https://i.postimg.cc/K8qF1vGL/gen.jpg"],
                    ["Tiểu Thuyết Của Nam Chính", "https://i.postimg.cc/2SPhNYsL/IMG-0191.jpg"], ["Vợ Tổng Tài Của Tôi", "https://i.postimg.cc/mrwq6mq4/gen.jpg"],
                    ["Chấm Dứt Với Gia Đình", "https://i.postimg.cc/bwsGz4bW/gen.jpg"], ["Cố Gắng Rời Xa Em", "https://i.postimg.cc/QC9pvvfg/gen.jpg"],
                    ["Chị Gái Nằm Với Tôi", "https://i.postimg.cc/2S1dmdbR/978D6BC2-7590-4E08-8877-DE859DBF5989.jpg"], ["Cha Mẹ Bắt Tôi Về", "https://i.postimg.cc/52pcdVCQ/IMG-0121.jpg"],
                    ["Chị Gái Loại Bỏ Tôi", "https://i.postimg.cc/VNVS5TSf/gen.jpg"], ["Các Chị Gái Của Tôi 2", "https://i.postimg.cc/rF6BqzKX/IMG-0092.jpg"],
                    ["Tôi Đã Bị Thay Thế", "https://i.postimg.cc/BvxsGDCf/IMG-0091.jpg"], ["So Tài Với Trà Xanh", "https://i.postimg.cc/B6rxPrK8/E68159C7-168F-4807-8399-14105CD445F0.jpg"],
                    ["Bắt Nạt Cô Thanh Mai", "https://i.postimg.cc/bwcDLQYK/gen.jpg"], ["Tôi Tránh Xa Thanh Mai", "https://i.postimg.cc/90kqjPQN/proxy-img.jpg"],
                    ["Đã Thật Lòng Với Em", "https://i.postimg.cc/MGwKgFzr/proxy-img.jpg"], ["Trợt Tỉnh Ra Sự Thật", "https://i.postimg.cc/rpgxmhPx/gen.jpg"],
                    ["Lấy Hoa Khôi Lạnh Lùng", "https://i.postimg.cc/htmQfNg9/gen.jpg"], ["Nữ Thần Liễu Như Yên", "https://i.postimg.cc/y8nPZmYS/gen.jpg"],
                    ["Tôi Nằm Trên Ván Cược", "https://i.postimg.cc/D0shyZ6b/gen.jpg"], ["Tái Sinh Cùng Vợ Mình", "https://i.postimg.cc/y6nhBL9c/gen.jpg"],
                    ["Không Cùng Thế Giới Mà", "https://i.postimg.cc/3wJfK4Ns/gen.jpg"], ["Hoàn Hảo Với Em Gái", "https://i.postimg.cc/PJs2GjKT/IMG-1498.jpg"]
                ];

                oldMovies.forEach((m, idx) => {
                    const slug = m[0].normalize('NFD').replace(/[đĐ]/g, 'd').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
                    const audio = m[2] || "https://files.catbox.moe/cikmvt.m4a";
                    const movieObj = {
                        slug: slug, title: m[0], coverImg: m[1], tag: idx < 5 ? "HOT" : "NEW", description: idx < 5 ? "Được xem nhiều" : "Vừa ra mắt",
                        views: Math.floor(Math.random() * 5000) + 1000, likes: Math.floor(Math.random() * 500) + 100,
                        uploadOrder: Date.now() - (idx * 1000), // Đánh mốc thời gian để truyện đầu tiên (idx 0) là mới nhất
                        seasons: [{
                            seasonNumber: 1, seasonName: "Phần 1",
                            episodes: [{ episodeNumber: 1, title: "Tập 1", audioUrl: audio, videoUrl: "", isPremium: false }]
                        }]
                    };
                    fs.writeFileSync(path.join(moviesDir, `${slug}.json`), JSON.stringify(movieObj, null, 4), 'utf-8');
                });
                console.log(`🎬 Đã TỰ ĐỘNG KHÔI PHỤC VÀ TẠO ${oldMovies.length} file JSON phim chuẩn vào thư mục movies_data!`);
            }
            
            // TÍNH NĂNG THÊM PHIM MỚI TỰ ĐỘNG (KHÔNG LÀM MẤT VIEW/LIKE CŨ)
            const newMoviesToAdd = [
                ["Vợ Tôi Đã Đánh Mất Tôi", "https://i.postimg.cc/wTdbctdH/88761587-401C-4312-B820-9CB0C1503B11.jpg", "https://videotourl.com/audio/1779281108637-7c7866e4-b7f8-4ea7-b9e8-acf451483f85.mp3", "https://videotourl.com/audio/1779281189661-a4f6af97-12ed-43b1-b16d-3808a50a9e90.mp3", "https://videotourl.com/audio/1779281271960-9f7ca7c7-6594-447d-91af-5a6b36e6707b.mp3"],
                ["Cố Gắng Kết Nối Với Em", "https://i.postimg.cc/LXBTYs5k/gen.jpg", "https://videotourl.com/audio/1779195308431-8a354d51-34d1-4673-87fb-cd40c097fcbb.m4a", "https://videotourl.com/audio/1779280333697-a25565a2-b70a-4ef9-b09f-cabe7d65980b.mp3", "https://videotourl.com/audio/1779280414769-74c0200b-8870-471a-951c-6cbd435586a6.mp3"],
                ["Gặp Vấn Đề Khi Đi Ly Hôn", "https://i.postimg.cc/nzYkjLr4/gen.jpg", "https://videotourl.com/audio/1779195065140-7ce406e7-74e7-49fa-a4c6-d975568d07ae.mp3", "https://videotourl.com/audio/1779195115735-d8493ad9-7608-46a5-a8f1-ddab0936ad00.mp3", "https://videotourl.com/audio/1779195202462-1e3726e3-2b2d-4d80-b70e-f0c0501911ea.mp3"],
                ["Tôi Muốn Ly Hôn Với Đại Lão", "https://i.postimg.cc/wx2293SM/69AACA28-C240-441A-84EC-3F04FDFDDA96.jpg", "https://videotourl.com/audio/1779192701252-a875996f-f6ea-47f2-ac5a-b41d6fa690f2.m4a"]
            ];
            
            newMoviesToAdd.forEach((m, idx) => {
                const slug = m[0].normalize('NFD').replace(/[đĐ]/g, 'd').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
                const filePath = path.join(moviesDir, `${slug}.json`);
                
                try {
                    const audio1 = m[2] || "https://files.catbox.moe/cikmvt.m4a";
                    const audio2 = m[3] || "";
                    const audio3 = m[4] || "";
                    const audio4 = m[5] || "";
                    const audio5 = m[6] || "";

                    const seasonsArr = [
                        { seasonNumber: 1, seasonName: "Phần 1", episodes: [{ episodeNumber: 1, title: "Tập 1", audioUrl: audio1, videoUrl: "", isPremium: false }] }
                    ];
                    if (audio2) seasonsArr.push({ seasonNumber: 2, seasonName: "Phần 2", episodes: [{ episodeNumber: 1, title: "Tập 1", audioUrl: audio2, videoUrl: "", isPremium: false }] });
                    if (audio3) seasonsArr.push({ seasonNumber: 3, seasonName: "Phần 3", episodes: [{ episodeNumber: 1, title: "Tập 1", audioUrl: audio3, videoUrl: "", isPremium: true }] });
                    if (audio4) seasonsArr.push({ seasonNumber: 4, seasonName: "Phần 4", episodes: [{ episodeNumber: 1, title: "Tập 1", audioUrl: audio4, videoUrl: "", isPremium: true }] });
                    if (audio5) seasonsArr.push({ seasonNumber: 5, seasonName: "Phần 5", episodes: [{ episodeNumber: 1, title: "Tập 1", audioUrl: audio5, videoUrl: "", isPremium: true }] });

                    let movieObj;
                    if (fs.existsSync(filePath)) {
                        // File đã tồn tại, đọc và cập nhật các phần mới
                        const rawData = fs.readFileSync(filePath);
                        movieObj = JSON.parse(rawData);
                        movieObj.seasons = seasonsArr;
                        console.log(`🔄 ĐÃ CẬP NHẬT CÁC PHẦN MỚI CHO PHIM: ${m[0]}`);
                    } else {
                        // File chưa tồn tại, tạo mới hoàn toàn
                        movieObj = {
                            slug: slug, title: m[0], coverImg: m[1], tag: "HOT", description: "Vừa ra mắt",
                            views: Math.floor(Math.random() * 5000) + 1000, likes: Math.floor(Math.random() * 500) + 100,
                            uploadOrder: Date.now() + 2000000 - (idx * 1000), // Cộng thêm mốc thời gian lớn để luôn đứng Top 1
                            seasons: seasonsArr
                        };
                        console.log(`🎬 ĐÃ THÊM PHIM MỚI VÀO HỆ THỐNG: ${m[0]}`);
                    }
                    fs.writeFileSync(filePath, JSON.stringify(movieObj, null, 4), 'utf-8');
                } catch (e) {
                    console.error(`🔴 Lỗi xử lý phim "${m[0]}":`, e.message);
                }
            });

            let files = fs.readdirSync(moviesDir).filter(file => file.endsWith('.json'));

            let movieCount = 0;
            for (let file of files) {
                try {
                    const rawData = fs.readFileSync(path.join(moviesDir, file));
                    const movieData = JSON.parse(rawData);
                    // Cập nhật nếu đã có, hoặc tạo mới nếu chưa có (Dựa vào slug)
                    await Movie.findOneAndUpdate({ slug: movieData.slug }, movieData, { upsert: true, new: true, setDefaultsOnInsert: true });
                    movieCount++;
                } catch (parseErr) {
                    console.log(`🔴 LỖI ĐỌC PHIM [${file}]: Dữ liệu bên trong bị sai cú pháp (Thiếu dấu phẩy, hoặc ngoặc kép). Hãy kiểm tra lại file này!`);
                }
            }
            console.log(`🎬 Đã đồng bộ thành công ${movieCount} bộ phim từ thư mục vào Database!`);
        } catch(e) { console.log('🔴 Lỗi đồng bộ phim:', e.message); }
    })
    .catch((err) => {
        console.log('\n======================================================');
        console.log('🔴 LỖI NGHIÊM TRỌNG: KHÔNG THỂ KẾT NỐI MONGODB ATLAS (ĐÁM MÂY)');
        console.log('👉 Có thể do 1 trong 3 nguyên nhân sau:');
        console.log('   1. Trên web MongoDB Atlas, phần Network Access bạn chưa chỉnh thành "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0).');
        console.log('   2. Mạng Wifi của bạn đang chặn kết nối ra nước ngoài (Thử phát 4G từ điện thoại sang máy tính xem sao).');
        console.log('   3. Mật khẩu kết nối bị sai.');
        console.log('📋 CHI TIẾT LỖI GỐC (HÃY COPY DÒNG NÀY GỬI CHO TÔI):', err.message);
        console.log('======================================================\n');
    });

// ==========================================
// 2. CÁC API HỆ THỐNG CƠ BẢN
// ==========================================
app.get('/', (req, res) => { res.send('Máy chủ ChuNhatPham đang hoạt động!'); });

app.post('/api/auth/register', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(500).json({ message: "Lỗi Server: Chưa kết nối Database. Vui lòng bật MongoDB!" });

        // Cắt bỏ mọi khoảng trắng thừa (thủ phạm khiến Đăng ký xong nhưng Đăng nhập báo sai)
        const phone = (req.body.phone || "").trim();
        const email = (req.body.email || "").trim();
        const username = (req.body.username || "").trim();
        const password = req.body.password;

        if (!phone || !email || !username || !password) return res.status(400).json({ message: "Dữ liệu bị rỗng! Vui lòng F5 tải lại trang và làm lại từ Bước 1 nhé." });

        // Tìm kiếm độc lập từng trường để báo lỗi tiếng Việt chính xác nhất
        const existingUser = await User.findOne({ 
            $or: [
                { phone }, 
                { email: { $regex: new RegExp(`^${email}$`, 'i') } }, 
                { username: { $regex: new RegExp(`^${username}$`, 'i') } }
            ] 
        });
        if (existingUser) {
            if (existingUser.username.toLowerCase() === username.toLowerCase()) return res.status(400).json({ message: "Tên tài khoản này đã có người sử dụng!" });
            if (existingUser.email.toLowerCase() === email.toLowerCase()) return res.status(400).json({ message: "Email này đã được đăng ký!" });
            return res.status(400).json({ message: "Số điện thoại này đã được đăng ký!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Tự động cấp quyền admin nếu tên tài khoản có chứa chữ "admin" (Bạn có thể đổi logic này sau)
        const role = username.toLowerCase().includes('admin') ? 'admin' : 'user';

        const newUser = new User({ 
            phone, 
            email, 
            username, 
            password: hashedPassword, 
            walletBalance: 0, 
            role: role,
            isPremium: false,
            premiumTier: 'none'
        });
        
        try {
            await newUser.save(); 
        } catch (saveErr) {
            if (saveErr.code === 11000) {
                const dupField = Object.keys(saveErr.keyValue)[0];
                const dupValue = saveErr.keyValue[dupField];
                return res.status(400).json({ message: `Dữ liệu '${dupValue}' đã bị trùng lặp ngầm trong Cơ sở dữ liệu!` });
            }
            throw saveErr;
        }

        res.status(201).json({ 
            message: "Đăng ký tài khoản thành công!", 
            user: { 
                username: newUser.username, 
                phone: newUser.phone,
                email: newUser.email,
                walletBalance: newUser.walletBalance, 
                isPremium: newUser.isPremium, 
                premiumTier: newUser.premiumTier, 
                role: newUser.role,
                noAdsExpiry: newUser.noAdsExpiry
            } 
        });
    } catch (error) { 
        console.error("LỖI ĐĂNG KÝ BACKEND:", error);
        res.status(500).json({ message: "Lỗi hệ thống: " + (error.message || error) }); 
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(500).json({ message: "Lỗi Server: Chưa kết nối Database. Vui lòng bật MongoDB!" });

        const username = (req.body.username || "").trim();
        const password = req.body.password;
        const user = await User.findOne({ $or: [{ phone: username }, { email: { $regex: new RegExp(`^${username}$`, 'i') } }, { username: { $regex: new RegExp(`^${username}$`, 'i') } }] });
        if (!user) return res.status(400).json({ message: "Tài khoản hoặc số điện thoại không tồn tại!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Mật khẩu không chính xác!" });

        // KIỂM TRA HẠN PREMIUM VÀ TỰ ĐỘNG GIÁNG CẤP NẾU HẾT HẠN
        if (user.isPremium && user.premiumExpiry && new Date() > new Date(user.premiumExpiry)) {
            user.isPremium = false;
            user.premiumTier = 'none';
            user.premiumExpiry = undefined;
            await user.save();
        }

        res.status(200).json({
            message: `Chào mừng ${user.username} quay trở lại!`,
            user: { username: user.username, phone: user.phone, email: user.email, walletBalance: user.walletBalance, isPremium: user.isPremium, premiumTier: user.premiumTier, premiumExpiry: user.premiumExpiry, noAdsExpiry: user.noAdsExpiry, role: user.role }
        });
    } catch (error) { 
        console.error("LỖI ĐĂNG NHẬP BACKEND:", error);
        res.status(500).json({ message: "Lỗi hệ thống: " + (error.message || error) }); 
    }
});

// ==========================================
// API QUÊN MẬT KHẨU (FORGOT PASSWORD)
// ==========================================
// Bước 1: Yêu cầu gửi mã OTP
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { identifier } = req.body;
        const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
        if (!user) return res.status(404).json({ message: "Tài khoản hoặc Email không tồn tại trên hệ thống!" });

        // Tạo mã OTP 6 số ngẫu nhiên
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordOtp = otp;
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // Mã sống trong 10 phút
        await user.save();

            const mailOptions = {
                from: '"ChuNhatPham Support" <changdinhanh@gmail.com>',
                to: user.email, // Gửi chính xác vào email liên kết của user này
                subject: 'Mã xác thực Khôi phục mật khẩu - ChuNhatPham',
                html: `<div style="font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4; border-radius: 10px;">
                        <h2 style="color: #e50914;">Yêu cầu đặt lại mật khẩu</h2>
                        <p>Chào <strong>${user.username}</strong>,</p>
                        <p>Bạn vừa yêu cầu đặt lại mật khẩu. Vui lòng nhập mã bảo mật dưới đây để xác minh:</p>
                        <h1 style="color: #00e676; letter-spacing: 5px; font-size: 30px; background: #222; padding: 10px; display: inline-block; border-radius: 8px;">${otp}</h1>
                        <p>Mã này sẽ hết hạn sau <strong>10 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
                       </div>`
            };
            await transporter.sendMail(mailOptions);
            
            // Che dấu email trước khi phản hồi (Ví dụ: nguyen***@gmail.com)
            const emailParts = user.email.split('@');
            const maskedEmail = emailParts[0].substring(0, 4) + '***@' + emailParts[1];

            return res.status(200).json({ message: "Đã gửi mã OTP thành công!", email: user.email, maskedEmail: maskedEmail });
    } catch (error) { console.log(error); res.status(500).json({ message: "Lỗi hệ thống khi gửi mã!" }); }
});

// Bước 2: Xác nhận OTP và Đổi mật khẩu mới
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ email: email, resetPasswordOtp: otp });

        if (!user) return res.status(400).json({ message: "Mã OTP không chính xác!" });
        if (user.resetPasswordExpires < Date.now()) return res.status(400).json({ message: "Mã OTP đã hết hạn. Vui lòng lấy mã mới!" });

        // Mã hóa mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        // Xóa mã OTP sau khi dùng xong
        user.resetPasswordOtp = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay." });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống!" }); }
});

app.post('/api/user/update', async (req, res) => {
    try {
        const { username, walletBalance, isPremium, premiumTier } = req.body;
        const updatedUser = await User.findOneAndUpdate(
            { username: username }, 
            { walletBalance, isPremium, premiumTier },
            { new: true }
        );
        if (!updatedUser) return res.status(404).json({ message: "Không tìm thấy tài khoản!" });
        res.status(200).json({ message: "Cập nhật thành công!", user: updatedUser });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống khi cập nhật!" }); }
});

// API ĐỔI MẬT KHẨU (KHI ĐANG ĐĂNG NHẬP)
app.post('/api/user/change-password', async (req, res) => {
    try {
        const { username, currentPassword, newPassword } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: "Người dùng không tồn tại!" });

        // Kiểm tra mật khẩu cũ
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Mật khẩu hiện tại không chính xác!" });

        // Cập nhật mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.status(200).json({ message: "Đổi mật khẩu thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống!" }); }
});

// API KIỂM TRA SỐ DƯ (Dùng cho quá trình quét Auto-Bank của Frontend)
app.get('/api/user/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

        // KIỂM TRA HẠN PREMIUM MỖI KHI FRONTEND LẤY DỮ LIỆU
        if (user.isPremium && user.premiumExpiry && new Date() > new Date(user.premiumExpiry)) {
            user.isPremium = false;
            user.premiumTier = 'none';
            user.premiumExpiry = undefined;
            await user.save();
        }
        // KIỂM TRA HẠN TẮT QUẢNG CÁO
        if (user.noAdsExpiry && new Date() > new Date(user.noAdsExpiry)) {
            user.noAdsExpiry = undefined;
            await user.save();
        }

        res.status(200).json(user);
    } catch (error) { res.status(500).json({ message: "Lỗi Server" }); }
});

// ==========================================
// API QUẢN LÝ PHIM (MOVIES)
// ==========================================
app.get('/api/movies', async (req, res) => {
    try {
        const movies = await Movie.find().sort({ uploadOrder: -1 }); // CHỈ XẾP THEO MỐC THỜI GIAN
        res.status(200).json(movies);
    } catch (error) { res.status(500).json({ message: "Lỗi Server" }); }
});

app.post('/api/movies/:slug/view', async (req, res) => {
    try {
        await Movie.findOneAndUpdate({ slug: req.params.slug }, { $inc: { views: 1 } });
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ message: "Lỗi Server" }); }
});

app.post('/api/movies/:slug/like', async (req, res) => {
    try {
        await Movie.findOneAndUpdate({ slug: req.params.slug }, { $inc: { likes: 1 } });
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ message: "Lỗi Server" }); }
});

// ==========================================
// API THÔNG BÁO (NOTIFICATION) & HỖ TRỢ
// ==========================================
app.get('/api/user/notifications/:username', async (req, res) => {
    try {
        const notifs = await Notification.find({ targetUsername: req.params.username }).sort({ createdAt: -1 });
        res.status(200).json(notifs);
    } catch (error) { res.status(500).json({ message: "Lỗi lấy thông báo!" }); }
});

app.post('/api/user/notifications/read/:id', async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ message: "Lỗi Server" }); }
});

app.post('/api/support', async (req, res) => {
    try {
        const { username, name, email, content, image } = req.body;
        
        // 1. Lưu vào Database cho Admin xem trên Web
        const newTicket = new Ticket({ username, name, email, content, image, status: 'pending' });
        await newTicket.save();

        // 2. Gửi Email thật về hộp thư của Admin (Đã bọc lớp bảo vệ chống sập)
        try {
            const mailOptions = { from: '"Hệ thống ChuNhatPham" <changdinhanh@gmail.com>', to: 'changdinhanh@gmail.com', subject: `[CẦN HỖ TRỢ] Từ người dùng: ${name}`, html: `<h3>Có một yêu cầu hỗ trợ mới trên Web:</h3><p><strong>Tài khoản:</strong> ${username}</p><p><strong>Họ tên/Liên hệ:</strong> ${name}</p><p><strong>Email cung cấp:</strong> ${email}</p><p><strong>Nội dung:</strong><br/>${content}</p><br/><p><i>* Đăng nhập vào trang Admin trên Web để xem ảnh và trả lời khách hàng.</i></p>`, attachments: image ? [{ filename: 'Loi_Minh_Hoa.png', path: image }] : [] };
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            console.log("🟡 Lỗi gửi Email báo Admin (Nhưng vé hỗ trợ vẫn được lưu vào Web an toàn):", mailErr.message);
        }

        res.status(200).json({ message: "Gửi hỗ trợ thành công!" });
    } catch (error) { console.error("🔴 LỖI TẠO TICKET SUPPORT:", error); res.status(500).json({ message: "Lỗi hệ thống khi gửi hỗ trợ: " + (error.message || "Unknown error") }); }
});

// ==========================================
// API CỘNG ĐỒNG CHAT GLOBAL
// ==========================================
app.get('/api/chat', async (req, res) => {
    try {
        // Lấy 100 tin nhắn gần nhất
        const messages = await ChatMessage.find().sort({ createdAt: 1 }).limit(100);
        res.status(200).json(messages);
    } catch (error) { res.status(500).json({ message: "Lỗi tải tin nhắn" }); }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { username, content, image, replyTo } = req.body;

        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng!" });

        // KIỂM TRA QUYỀN LỢI ADMIN
        if (user.role !== 'admin') {
            if (!content) return res.status(400).json({ message: "Vui lòng nhập nội dung!" });
            if (content.length > 100) return res.status(400).json({ message: "Tin nhắn không được quá 100 ký tự!" });
            if (image) return res.status(403).json({ message: "Chỉ Admin mới được gửi ảnh!" });

            // Kiểm tra giới hạn Icon (Tối đa 3 emoji)
            const emojiRegex = /\p{Emoji_Presentation}/gu;
            const emojiCount = (content.match(emojiRegex) || []).length;
            if (emojiCount > 3) return res.status(400).json({ message: "Bạn chỉ được phép sử dụng tối đa 3 biểu tượng cảm xúc để tránh Spam!" });

            // Reset bộ đếm nếu sang ngày mới
            const today = new Date().setHours(0, 0, 0, 0);
            const lastMsgDate = user.lastMsgDate ? new Date(user.lastMsgDate).setHours(0, 0, 0, 0) : 0;
            if (lastMsgDate !== today) user.dailyMsgCount = 0;

            // Kiểm tra giới hạn theo luật: Thường = 1, VIP = 5
            const limit = user.isPremium ? 5 : 1;
            if (user.dailyMsgCount >= limit) {
                return res.status(403).json({ message: `Hôm nay bạn đã đạt giới hạn gửi tin nhắn (${limit} tin). Vui lòng quay lại vào ngày mai!` });
            }
        }

        // Lưu tin nhắn
        const newMsg = new ChatMessage({
            username: user.username, content, image, replyTo, role: user.role, isPremium: user.isPremium, premiumTier: user.premiumTier
        });
        await newMsg.save();

        // Chỉ tăng bộ đếm cho user thường
        if (user.role !== 'admin') {
            user.dailyMsgCount += 1;
            user.lastMsgDate = new Date();
            await user.save();
        }

        res.status(200).json({ message: "Đã gửi tin nhắn!", msg: newMsg });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống khi gửi tin" }); }
});

// XÓA TIN NHẮN
app.delete('/api/chat/:id', async (req, res) => {
    try {
        const { username } = req.body;
        const msg = await ChatMessage.findById(req.params.id);
        if (!msg) return res.status(404).json({ message: "Không tìm thấy tin nhắn" });

        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: "Tài khoản không hợp lệ" });

        // Chỉ cho phép người gửi hoặc Admin xóa
        if (user.role !== 'admin' && msg.username !== username) {
            return res.status(403).json({ message: "Bạn chỉ có thể xóa tin nhắn của chính mình!" });
        }

        msg.isDeleted = true; // Soft delete
        await msg.save();
        res.status(200).json({ message: "Đã thu hồi tin nhắn" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

// GHIM TIN NHẮN (CHỈ ADMIN)
app.post('/api/chat/:id/pin', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (!user || user.role !== 'admin') return res.status(403).json({ message: "Chỉ Admin mới có quyền ghim tin nhắn!" });

        const msg = await ChatMessage.findById(req.params.id);
        if (!msg) return res.status(404).json({ message: "Không tìm thấy tin nhắn" });

        // Bỏ ghim tất cả các tin nhắn cũ
        await ChatMessage.updateMany({}, { isPinned: false });
        
        if (!msg.isPinned) { msg.isPinned = true; await msg.save(); res.status(200).json({ message: "Đã ghim tin nhắn" }); } 
        else { res.status(200).json({ message: "Đã bỏ ghim" }); }
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

// THẢ CẢM XÚC
app.post('/api/chat/:id/react', async (req, res) => {
    try {
        const { username, emoji } = req.body;
        const msg = await ChatMessage.findById(req.params.id);
        if (!msg || msg.isDeleted) return res.status(404).json({ message: "Không thể tương tác với tin nhắn này" });

        // Kiểm tra xem user đã thả cảm xúc này chưa, nếu có thì gỡ bỏ, chưa có thì thêm vào
        const existingReactIndex = msg.reactions.findIndex(r => r.username === username && r.emoji === emoji);
        if (existingReactIndex > -1) {
            msg.reactions.splice(existingReactIndex, 1);
        } else {
            // Nếu đổi cảm xúc khác, xóa cái cũ của user đó đi
            msg.reactions = msg.reactions.filter(r => r.username !== username);
            msg.reactions.push({ username, emoji });
        }
        
        await msg.save();
        res.status(200).json({ message: "Thành công" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

// ==========================================
// API MUA GÓI PREMIUM (BẢO MẬT GIAO DỊCH TẠI SERVER)
// ==========================================
app.post('/api/user/buy-premium', async (req, res) => {
    try {
        const { username, months, price, tier } = req.body;
        const user = await User.findOne({ username });
        
        if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản!" });
        if (user.walletBalance < price) return res.status(400).json({ message: "Số dư ví không đủ, vui lòng nạp thêm!" });

        // Trừ tiền
        user.walletBalance -= price;
        user.isPremium = true;
        user.premiumTier = tier;

        // Cộng dồn thời gian (Nếu đang có VIP thì cộng thêm, nếu không thì tính từ hôm nay)
        let baseDate = (user.premiumExpiry && new Date(user.premiumExpiry) > new Date()) ? new Date(user.premiumExpiry) : new Date();
        baseDate.setMonth(baseDate.getMonth() + parseInt(months));
        user.premiumExpiry = baseDate;

        await user.save();
        
        // Lưu lịch sử giao dịch (Spend)
        const newTx = new Transaction({ referenceCode: 'PREM_' + Date.now(), contact: user.phone, amount: -price, content: `Mua gói Premium ${months} Tháng` });
        await newTx.save();

        res.status(200).json({ message: "Nâng cấp Premium thành công!", user: { walletBalance: user.walletBalance, isPremium: user.isPremium, premiumTier: user.premiumTier, premiumExpiry: user.premiumExpiry } });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống khi thanh toán!" }); }
});

// ==========================================
// API MUA GÓI TẮT QUẢNG CÁO 20K/7 NGÀY
// ==========================================
app.post('/api/user/buy-no-ads', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        
        if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản!" });
        if (user.isPremium) return res.status(400).json({ message: "Tài khoản Premium đã mặc định tắt quảng cáo!" });
        if (user.walletBalance < 20000) return res.status(400).json({ message: "Số dư ví không đủ 20.000đ!" });

        user.walletBalance -= 20000;
        let baseDate = (user.noAdsExpiry && new Date(user.noAdsExpiry) > new Date()) ? new Date(user.noAdsExpiry) : new Date();
        baseDate.setDate(baseDate.getDate() + 7);
        user.noAdsExpiry = baseDate;
        await user.save();

        const newTx = new Transaction({ referenceCode: 'NOADS_' + Date.now(), contact: user.phone, amount: -20000, content: `Mua gói Tắt Quảng Cáo 7 Ngày` });
        await newTx.save();
        res.status(200).json({ message: "Kích hoạt Tắt Quảng Cáo thành công!", user: { walletBalance: user.walletBalance, noAdsExpiry: user.noAdsExpiry } });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống!" }); }
});

// ==========================================
// API QUẢN TRỊ VIÊN (ADMIN)
// ==========================================
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) { res.status(500).json({ message: "Lỗi lấy danh sách user" }); }
});

app.get('/api/admin/transactions', async (req, res) => {
    try {
        // Lấy danh sách giao dịch, sẽ được sắp xếp ở Frontend để đảm bảo an toàn
        const txs = await Transaction.find();
        res.status(200).json(txs);
    } catch (error) { res.status(500).json({ message: "Lỗi lấy danh sách giao dịch" }); }
});

app.post('/api/admin/add-balance', async (req, res) => {
    try {
        const { targetUsername, amount } = req.body;
        const user = await User.findOne({ username: targetUsername });
        
        if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng này!" });
        
        user.walletBalance += parseInt(amount);
        await user.save();

        const newTx = new Transaction({ referenceCode: 'MANUAL_' + Date.now(), contact: user.phone, amount: parseInt(amount), content: 'Admin duyệt nạp thủ công' });
        await newTx.save();

        res.status(200).json({ success: true, message: `Đã cộng ${amount}đ cho ${user.username}`, newBalance: user.walletBalance });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống!" }); }
});

// API XÓA TÀI KHOẢN
app.delete('/api/admin/user/:username', async (req, res) => {
    try {
        const deletedUser = await User.findOneAndDelete({ username: req.params.username });
        if (!deletedUser) return res.status(404).json({ message: "Không tìm thấy user!" });
        res.status(200).json({ message: "Đã xóa tài khoản vĩnh viễn!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống!" }); }
});

// API CHỈNH SỬA TÀI KHOẢN (ĐỔI MẬT KHẨU, SỐ DƯ, VIP)
app.put('/api/admin/user/:username', async (req, res) => {
    try {
        const { newPassword, newBalance, isPremium, premiumTier } = req.body;
        let updateData = { 
            walletBalance: parseInt(newBalance) || 0, 
            isPremium: isPremium === 'true' || isPremium === true, 
            premiumTier: premiumTier 
        };

        // Nếu Admin nhập mật khẩu mới thì mới cập nhật mật khẩu
        if (newPassword && newPassword.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(newPassword, salt);
        }

        const updatedUser = await User.findOneAndUpdate({ username: req.params.username }, updateData, { new: true });
        if (!updatedUser) return res.status(404).json({ message: "Không tìm thấy user!" });

        res.status(200).json({ message: "Cập nhật tài khoản thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống!" }); }
});

app.get('/api/admin/tickets', async (req, res) => {
    try {
        // Bỏ sắp xếp ở đây để tránh lỗi do dữ liệu cũ/hỏng. Sẽ sắp xếp ở Frontend.
        const tickets = await Ticket.find();
        res.status(200).json(tickets);
    } catch (error) { res.status(500).json({ message: "Lỗi lấy danh sách hỗ trợ" }); }
});

app.post('/api/admin/ticket/reply', async (req, res) => {
    try {
        const { ticketId, replyContent } = req.body;
        const ticket = await Ticket.findByIdAndUpdate(ticketId, { status: 'replied', replyContent }, { new: true });
        if(!ticket) return res.status(404).json({ message: "Không tìm thấy phiếu!" });

        // Tạo thông báo gửi đến cái Chuông của khách hàng
        const newNotif = new Notification({ targetUsername: ticket.username, title: "Phản hồi Hỗ Trợ", message: `Quản trị viên đã trả lời phiếu hỗ trợ của bạn: "${replyContent}"` });
        await newNotif.save();
        res.status(200).json({ message: "Đã gửi câu trả lời cho khách!" });
    } catch (error) { res.status(500).json({ message: "Lỗi Server" }); }
});

// ==========================================
// 3. API ĐẶC BIỆT: TIẾP NHẬN WEBHOOK TỪ SEPAY
// ==========================================
// NÂNG CẤP: Thêm cơ chế chống cộng tiền 2 lần và ghi log chi tiết để dễ debug
app.post('/api/webhook/sepay', async (req, res) => {
    try {
        const data = req.body;
        // Ghi log toàn bộ dữ liệu nhận được từ SePay để dễ dàng debug
        console.log('[WEBHOOK SEPAY] 🟢 Dữ liệu nhận được:', JSON.stringify(data, null, 2));
        
        // Lấy các trường cần thiết từ SePay.
        // LƯU Ý: 'transactionID' là mã giao dịch duy nhất từ SePay. 
        // BẠN CẦN KIỂM TRA LẠI TÊN TRƯỜNG NÀY TRONG TÀI LIỆU CỦA SEPAY.
        // Nó có thể là 'reference', 'id', 'transaction_id', 'request_id', v.v...
        const transactionID = data.id || data.referenceCode || data.transactionID || Date.now().toString(); 
        const content = data.content || data.description || "";
        const transferAmount = data.transferAmount || data.amount || 0;
        const transferType = data.transferType || data.type || 'in'; // Mặc định là 'in' nếu SePay không gửi

        // 1. Kiểm tra các dữ liệu cơ bản
        if (transferType !== 'in' || !transferAmount) {
            console.log('[WEBHOOK SEPAY] 🟡 Không có số tiền hoặc không phải tiền vào. Bỏ qua.');
            return res.status(200).json({ message: "Bỏ qua." });
        }

        // 2. Chống cộng tiền 2 lần cho cùng 1 giao dịch (QUAN TRỌNG)
        const existingTransaction = await Transaction.findOne({ referenceCode: transactionID });
        if (existingTransaction) {
            console.log(`[WEBHOOK SEPAY] 🟡 Giao dịch ${transactionID} đã được xử lý trước đó. Bỏ qua.`);
            return res.status(200).json({ message: "Giao dịch đã được xử lý." });
        }

        // 3. Phân tích nội dung chuyển khoản
        // Ngân hàng thường tự động cắt khoảng trắng. VD: "NAP 098" thành "NAP098".
        // Do đó ta xóa sạch khoảng trắng để so khớp cho chuẩn.
        // Ngân hàng thường chèn thêm tên hoặc mã GD phía sau. VD: "NAP 0987654321 NGUYEN VAN A"
        const normalizedContent = (content || "").toUpperCase().replace(/\s+/g, '');
        const napIndex = normalizedContent.indexOf('NAP');
        
        if (napIndex === -1) {
            console.log(`[WEBHOOK SEPAY] 🔴 Nội dung "${content}" không chứa từ khóa "NAP".`);
            return res.status(200).json({ message: "Nội dung không đúng cú pháp." });
        }
        
        const afterNap = normalizedContent.substring(napIndex + 3); // Lấy toàn bộ chuỗi nằm sau chữ NAP
        const amount = parseInt(transferAmount) || 0;
        let user = null;
        let matchedIdentifier = "";
        
        // Ưu tiên 1: Quét tìm chính xác Số điện thoại (Bắt đầu bằng 0 hoặc 84, theo sau là 9 số)
        const phoneMatch = afterNap.match(/^((?:0|84)[0-9]{9})/);
        if (phoneMatch) {
            matchedIdentifier = phoneMatch[1];
            user = await User.findOne({ phone: matchedIdentifier });
        }

        // Ưu tiên 2: Nếu khách tự gõ tên Username thay vì SĐT, tìm kiếm cắt dần từ cuối (Bỏ qua rác của Ngân hàng)
        if (!user) {
            const possibleStr = afterNap.substring(0, 30); // Giới hạn kiểm tra 30 ký tự
            for (let i = possibleStr.length; i > 0; i--) {
                const testUsername = possibleStr.substring(0, i);
                user = await User.findOne({ username: { $regex: new RegExp(`^${testUsername}$`, 'i') } });
                if (user) {
                    matchedIdentifier = testUsername;
                    break;
                }
            }
        }

        if (!user) {
            console.log(`[WEBHOOK SEPAY] 🔴 Không tìm thấy tài khoản SĐT/Username "${afterNap}" từ nội dung gốc: "${content}".`);
            return res.status(200).json({ message: "Tài khoản không tồn tại." });
        }

        // 5. Cộng tiền và lưu lại giao dịch để chống trùng lặp
        user.walletBalance += amount;
        await user.save();

        const newTransaction = new Transaction({ referenceCode: transactionID, contact: user.phone, amount, content: normalizedContent });
        await newTransaction.save();

        console.log(`[HỆ THỐNG AUTO-BANK] ✅ XỬ LÝ THÀNH CÔNG! Đã cộng +${amount}đ cho tài khoản: ${user.username} (Mã GD: ${transactionID})`);
        res.status(200).json({ success: true, message: "Xử lý biến động số dư thành công!" });
    } catch (error) {
        console.error("Lỗi xử lý Webhook SePay:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống Webhook" });
    }
});

// ==========================================
// 4. KHỞI ĐỘNG MÁY CHỦ
// ==========================================
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Máy chủ đang chạy tại: http://localhost:${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n🔴 LỖI NGHIÊM TRỌNG: Cổng ${PORT} đang bị chiếm dụng!\n👉 NGUYÊN NHÂN: Bạn đang mở 2 Terminal cùng chạy Server một lúc.\n👉 CÁCH SỬA: Hãy TẮT HOÀN TOÀN phần mềm VS Code đi, sau đó mở lại, bật 1 Terminal duy nhất và gõ 'node server.js'\n`);
        process.exit(1);
    }
});