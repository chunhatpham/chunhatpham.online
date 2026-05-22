// ================= LOADING EFFECT =================
window.executeWithLoading = function(callback, delay = 600) {
    const loader = document.getElementById('global-loader-overlay');
    loader.style.display = 'flex';
    // Đợi 1 chút xíu để DOM render cái loader
    setTimeout(() => { loader.classList.add('show'); }, 10);
    
    setTimeout(() => {
        if(typeof callback === 'function') callback();
        loader.classList.remove('show');
        setTimeout(() => { loader.style.display = 'none'; }, 300); 
    }, delay);
};

// ================= KHO DỮ LIỆU PHIM CHÍNH TỔNG HỢP =================
window.realMoviesDatabase = []; // Sẽ được nạp từ Server DB

window.fetchMoviesFromDatabase = async function() {
    try {
        // Thêm timestamp để PHÁ BỘ NHỚ ĐỆM của trình duyệt, ép tải dữ liệu thật
        let res = await fetch('https://chunhatpham-online.onrender.com/api/movies?nocache=' + new Date().getTime());
        window.realMoviesDatabase = await res.json();
        
        // Render lại toàn bộ giao diện sau khi có dữ liệu
        if(typeof renderLatestMovies === 'function') renderLatestMovies();
        if(typeof window.renderMoviesByPage === 'function') window.renderMoviesByPage(1);
        if(typeof renderPagination === 'function') renderPagination(1);
    } catch (e) { console.error("Lỗi lấy dữ liệu phim:", e); }
};

window.renderLatestMovies = function() {
    const latestGrid = document.getElementById('latest-movie-grid');
    if (!latestGrid) return;
    
    // Lấy chính xác 20 phim mới nhất theo thứ tự gốc
    let displayMovies = window.realMoviesDatabase.slice(0, 20);
    latestGrid.innerHTML = displayMovies.map(movie => `
        <div class="movie-card" data-slug="${movie.slug}" onclick="openPlayer('${movie.slug}')">
            <img src="${movie.coverImg}" alt="${movie.title}">
            <div class="new-badge-tag">${movie.tag}</div>
            <div class="card-overlay"><h3>${movie.title}</h3><span style="color: #38ef7d;"><i class="fas fa-play-circle"></i> ${movie.description || 'Vừa ra mắt'}</span></div>
        </div>
    `).join('');
};

window.renderMoviesByPage = function(page) {
    const pagedGrid = document.getElementById('paged-movie-grid');
    if (!pagedGrid) return;
    const startIndex = (page - 1) * 10; 
    // CẬP NHẬT: Tính toán điểm dừng dựa trên số lượng phim THỰC TẾ
    const endIndex = Math.min(page * 10, window.realMoviesDatabase.length) - 1;
    let html = '';
    for (let i = startIndex; i <= endIndex; i++) {
        let movie = window.realMoviesDatabase[i];
        html += `<div class="movie-card dynamic-page-card" data-slug="${movie.slug}" onclick="openPlayer('${movie.slug}')">
            <img src="${movie.coverImg}"><div class="movie-index-badge" style="background: var(--primary-color);">#${i + 1}</div>
            <div class="card-overlay"><h3>${movie.title}</h3><span style="color: #38ef7d;"><i class="fas fa-play-circle"></i> ${movie.views} Lượt xem</span></div>
        </div>`;
    }
    pagedGrid.innerHTML = html;
};

function renderPagination(page) {
    // CẬP NHẬT: Tự động chia số trang theo số lượng phim đang có
    const TOTAL_PAGES = Math.ceil(window.realMoviesDatabase.length / 10) || 1;
    const paginationWrapper = document.getElementById('pagination-wrapper');
    if(!paginationWrapper) return;
    let html = '';
    const prevDisabled = page === 1 ? 'disabled' : '';
    html += `<div class="page-btn ${prevDisabled}" onclick="goToPage(${page - 1})"><i class="fas fa-chevron-left"></i></div>`;

    let pages = [];
    if (page <= 3) { pages = [1, 2, 3, 4, '...', TOTAL_PAGES]; } 
    else if (page >= TOTAL_PAGES - 2) { pages = [1, '...', TOTAL_PAGES - 3, TOTAL_PAGES - 2, TOTAL_PAGES - 1, TOTAL_PAGES]; } 
    else { pages = [1, '...', page - 1, page, page + 1, '...', TOTAL_PAGES]; }

    pages.forEach(p => {
        if (p === '...') { html += `<div class="page-dots">...</div>`; } 
        else {
            const activeClass = p === page ? 'active' : '';
            html += `<div class="page-btn ${activeClass}" onclick="goToPage(${p})">${p}</div>`;
        }
    });

    const nextDisabled = page === TOTAL_PAGES ? 'disabled' : '';
    html += `<div class="page-btn ${nextDisabled}" onclick="goToPage(${page + 1})"><i class="fas fa-chevron-right"></i></div>`;

    paginationWrapper.innerHTML = html;
}

window.goToPage = function(page) {
    if (page < 1) return;
    window.renderMoviesByPage(page);
    renderPagination(page);
    const gridTop = document.getElementById('paged-movie-grid').offsetTop - 100;
    window.scrollTo({ top: gridTop, behavior: 'smooth' });
};

// ================= TÌM KIẾM THÔNG MINH (FUZZY SEARCH) =================
function normalizeVietnamese(str) {
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd').replace(/Đ/g, 'D')
              .toLowerCase().trim();
}

window.handleSearchKeyPress = function(e) {
    if (e.key === 'Enter') {
        executeSearch();
    }
};

window.executeSearch = function() {
    let input = document.getElementById('main-search-input').value;
    if(!input.trim()) {
        showNotification('warning', 'Chưa Nhập Từ Khóa', 'Vui lòng nhập tên phim cần tìm!', 'Đã hiểu');
        return;
    }
    
    let normalizedInput = normalizeVietnamese(input);
    let foundIndex = window.realMoviesDatabase.findIndex(m => normalizeVietnamese(m.title).includes(normalizedInput));

    if (foundIndex !== -1) {
        let movie = window.realMoviesDatabase[foundIndex];
        openTab('tab-list');
        let targetPage = Math.floor(foundIndex / 10) + 1;
        goToPage(targetPage);
        
        setTimeout(() => {
            let cards = document.querySelectorAll('#paged-movie-grid .movie-card');
            let foundCard = null;
            cards.forEach(card => {
                let h3 = card.querySelector('h3');
                if(h3 && h3.innerText === movie.title) {
                    foundCard = card;
                }
            });
            
            if(foundCard) {
                foundCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                document.querySelectorAll('.movie-card').forEach(c => {
                    c.classList.remove('search-highlight');
                    let oldTooltip = c.querySelector('.search-tooltip');
                    if(oldTooltip) oldTooltip.remove();
                });

                foundCard.classList.add('search-highlight');
                let tooltip = document.createElement('div');
                tooltip.className = 'search-tooltip';
                tooltip.innerText = `Đã tìm thấy: ${movie.title}`;
                foundCard.appendChild(tooltip);

                    showNotification('success', 'Tìm Kiếm Thành Công', `Bạn đã tìm đến bộ phim: "${movie.title}". Xin hãy nhấp vào khung phim đang sáng nhấp nháy để xem nhé!`, 'Tuyệt vời');

                setTimeout(() => {
                    foundCard.classList.remove('search-highlight');
                    if(tooltip) tooltip.remove();
                    }, 6000);
                }
            }, 400); // Tăng thời gian đợi để web render trang chứa phim kịp thời
        } else {
            showNotification('info', 'Không Tìm Thấy', 'Cảm ơn bạn, chúng tôi hiện chưa có phim này và sẽ cố gắng cập nhật sớm nhất ạ.', 'Đã hiểu');
    }
};

// ================= GIAO DIỆN & TIỆN ÍCH CHUNG =================
function showNotification(type, title, msg, btnText) {
    const overlay = document.getElementById('global-modal-overlay'), box = document.getElementById('global-modal-box'), icon = document.getElementById('modal-icon'), btn = document.getElementById('modal-action-btn');
    document.getElementById('modal-title').innerText = title; document.getElementById('modal-message').innerText = msg; btn.innerText = btnText;
    icon.style.animation = 'none'; icon.offsetHeight; 
    if(type === 'warning') { icon.className = 'fas fa-exclamation-triangle'; icon.style.color = '#ff4e00'; box.style.borderColor = '#ff4e00'; box.style.boxShadow = '0 10px 40px rgba(255, 78, 0, 0.3)'; btn.style.background = 'linear-gradient(45deg, #ff4e00, #ec9f05)'; icon.style.animation = 'shake 0.5s'; } 
    else if(type === 'error') { icon.className = 'fas fa-times-circle'; icon.style.color = '#e94560'; box.style.borderColor = '#e94560'; box.style.boxShadow = '0 10px 40px rgba(233, 69, 96, 0.3)'; btn.style.background = '#e94560'; icon.style.animation = 'shake 0.5s'; }
    else if(type === 'success') { icon.className = 'fas fa-check-circle'; icon.style.color = '#00e676'; box.style.borderColor = '#00e676'; box.style.boxShadow = '0 10px 40px rgba(0, 230, 118, 0.3)'; btn.style.background = 'linear-gradient(45deg, #00c6ff, #00e676)'; icon.style.animation = 'pulseGlow 1s infinite alternate'; } 
    else if(type === 'info') { icon.className = 'fas fa-info-circle'; icon.style.color = '#8e2de2'; box.style.borderColor = '#8e2de2'; box.style.boxShadow = '0 10px 40px rgba(142, 45, 226, 0.3)'; btn.style.background = 'linear-gradient(45deg, #8e2de2, #4a00e0)'; icon.style.animation = 'floatIcon 2s ease-in-out infinite'; }
    overlay.classList.add('show');
}
function closeNotification() { document.getElementById('global-modal-overlay').classList.remove('show'); }
document.getElementById('global-modal-overlay').addEventListener('click', function(e) { if(e.target === this) closeNotification(); });

const sidebar = document.getElementById('sidebar');
const menuLinks = document.querySelectorAll('.menu-link');
const tabContents = document.querySelectorAll('.tab-content');
document.getElementById('menu-btn').addEventListener('click', () => sidebar.classList.add('active'));
document.getElementById('close-btn').addEventListener('click', () => sidebar.classList.remove('active'));

window.openTab = function(targetId) {
    if (!targetId) return; // Bảo vệ: Không làm gì nếu không có ID mục tiêu
    window.executeWithLoading(() => {
        tabContents.forEach(tab => tab.classList.remove('active'));
        menuLinks.forEach(link => link.classList.remove('active-link'));
        let targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('active');
        menuLinks.forEach(link => { if(link.getAttribute('data-target') === targetId) link.classList.add('active-link'); });
        sidebar.classList.remove('active'); 
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Nếu là Tab Khám Phá (Cộng Đồng)
        if (targetId === 'tab-single') {
            showNotification('info', 'Chào Mừng', 'Xin chào bạn đến với cộng đồng của chunhatpham!', 'Vào Chat');
            if(typeof window.loadChatMessages === 'function') window.loadChatMessages();
        }
        
        if(typeof window.triggerEventBanner === 'function') window.triggerEventBanner();
    }, 500);
};
menuLinks.forEach(link => { link.addEventListener('click', function(e) { e.preventDefault(); openTab(this.getAttribute('data-target')); }); });

window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (window.scrollY > 50) header.style.background = 'rgba(11, 11, 12, 0.95)'; else header.style.background = 'rgba(11, 11, 12, 0.8)';
});

document.addEventListener("DOMContentLoaded", () => {
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.classList.add('is-scrolling-in'); } 
            else { entry.target.classList.remove('is-scrolling-in'); }
        });
    }, { root: null, rootMargin: '0px', threshold: 0.6 });

    document.querySelectorAll('.movie-card').forEach(card => { scrollObserver.observe(card); });
});

// ================= LOGIC MODAL XEM PHIM & QUẢNG CÁO =================
window.adUnlockStep = 0; 
const MAX_AD_CLICKS = 3; 

window.showAdProgressToast = function(currentStep) {
    const toast = document.getElementById('ad-progress-toast');
    const fill = document.getElementById('ad-progress-fill');
    const countText = document.getElementById('ad-progress-count');
    const desc = document.getElementById('ad-toast-desc');
    const icon = document.querySelector('.ad-toast-icon i');
    const iconBox = document.querySelector('.ad-toast-icon');

    if (!toast) return;

    let percentage = (currentStep / MAX_AD_CLICKS) * 100;
    fill.style.width = percentage + '%';
    countText.innerText = `${currentStep}/${MAX_AD_CLICKS}`;

    if (currentStep < MAX_AD_CLICKS) {
        desc.innerText = `Bạn hãy bấm đủ ${MAX_AD_CLICKS} lần để mở bộ phim lên nhá, nếu không muốn quảng cáo có thể mua gói tắt quảng cáo hoặc lên Premium nhé (còn ${MAX_AD_CLICKS - currentStep} lần).`;
        desc.style.color = "#f5c518";
        icon.className = "fas fa-hand-pointer";
        iconBox.style.background = "linear-gradient(135deg, #f5c518, #ff9800)";
        iconBox.style.boxShadow = "0 5px 15px rgba(245, 197, 24, 0.4)";
    } else {
        desc.innerText = "Nhiệm vụ hoàn tất! Hệ thống đang tải nội dung cho bạn...";
        desc.style.color = "#00e676";
        icon.className = "fas fa-check";
        iconBox.style.background = "linear-gradient(135deg, #00e676, #1de9b6)";
        iconBox.style.boxShadow = "0 5px 15px rgba(0, 230, 118, 0.4)";
    }

    toast.classList.add('show');
    clearTimeout(window.adToastTimer);
    window.adToastTimer = setTimeout(() => { closeAdToast(); }, currentStep === MAX_AD_CLICKS ? 3000 : 6000);
};

window.closeAdToast = function() {
    const toast = document.getElementById('ad-progress-toast');
    if(toast) toast.classList.remove('show');
};

window.currentPlayingAudio = "";
window.currentPlayingVideo = "https://example.com/link-video-vip-cua-ban"; 
window.currentMovieSlug = ""; // Lưu trữ phim hiện tại để bấm like/chia sẻ

window.openPlayer = function(movieSlug) {
    // --- HỆ THỐNG YÊU CẦU CLICK QUẢNG CÁO ĐỂ MỞ KHÓA ---
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    let isVip = currentUser && currentUser.isPremium;
    let hasNoAdsPack = currentUser && currentUser.noAdsExpiry && (new Date(currentUser.noAdsExpiry) > new Date());
    let bypassAds = isVip || hasNoAdsPack;

    if (!bypassAds && window.adUnlockStep < MAX_AD_CLICKS) {
        const adLinks = [
            "https://vt.tiktok.com/ZS9eQnVNkWqrH-NDwQg/",
            "https://vt.tiktok.com/ZS9eQnpk1jcTU-0sAGn/",
            "https://vt.tiktok.com/ZS9eQntSfgCqA-VUA7g/",
            "https://vt.tiktok.com/ZS9RdMkvcsYJR-5XXqs/",
            "https://vt.tiktok.com/ZS9RdMDFCcqDr-Wkvnr/",
            "https://vt.tiktok.com/ZS9RdM5HDghE3-elmmE/",
            "https://vt.tiktok.com/ZS9RdMaACXLWq-W52rL/",
            "https://vt.tiktok.com/ZS9RdMQDJELpG-ro8Sc/",
            "https://vt.tiktok.com/ZS9RdMqtxbCqJ-sPyPM/",
            "https://vt.tiktok.com/ZS9RdMnUbwUyf-ajbD7/",
            "https://vt.tiktok.com/ZS9RdMWyakByQ-0Uozs/",
            "https://vt.tiktok.com/ZS9RdMTBSXFH1-4eGKd/",
            "https://vt.tiktok.com/ZS989E7k8ANFf-FKqU9/",
            "https://vt.tiktok.com/ZS989ETLJpFgc-muMiW/",
            "https://vt.tiktok.com/ZS98nGsEU2MW9-bnMez/",
            "https://vt.tiktok.com/ZS98nG7KYH7nH-tGp2g/",
            "https://vt.tiktok.com/ZS983jmkcJ5Yv-HhrHa/",
            "https://vt.tiktok.com/ZS983jxss8YFG-ncouM/"
        ];
        
        window.adUnlockStep++;
        window.showAdProgressToast(window.adUnlockStep); 
        
        let randomAdUrl = adLinks[Math.floor(Math.random() * adLinks.length)];
        window.open(randomAdUrl, '_blank');

        if (window.adUnlockStep < MAX_AD_CLICKS) return; 
    }
    
    // Xóa bộ đếm để lần sau bấm phim khác lại yêu cầu quảng cáo từ đầu
    window.adUnlockStep = 0;

    window.currentMovieSlug = movieSlug;
    // Tìm thông tin phim chuẩn từ Database (Tương thích cả click theo Slug lẫn Title)
    let movie = window.realMoviesDatabase.find(m => m.slug === movieSlug || m.title === movieSlug);
    
    let movieTitle = movieSlug;
    let movieImg = "https://i.postimg.cc/BZTQdwdb/56575EA9-6C1E-453E-A0EE-628BF972D3E7.png";
    
    if (movie) {
        movieTitle = movie.title;
        movieImg = movie.coverImg;
        document.getElementById('lm-likes-count').innerText = movie.likes || 0;
        document.getElementById('lm-views-count').innerText = (movie.views || 0) + 1; // +1 giả định để tạo hiệu ứng lên view
        // Gọi API tăng View âm thầm
        fetch(`https://chunhatpham-online.onrender.com/api/movies/${movie.slug}/view`, { method: 'POST' }).catch(e=>{});
    } else {
        // Fallback bảo vệ giao diện: Nếu phim chưa có trong Database, tìm ảnh trên màn hình để load tạm
        try { if (window.event && window.event.currentTarget) { let imgEl = window.event.currentTarget.querySelector('img'); if (imgEl) movieImg = imgEl.src; } } catch(e) {}
        document.getElementById('lm-likes-count').innerText = Math.floor(Math.random() * 500) + 50;
        document.getElementById('lm-views-count').innerText = Math.floor(Math.random() * 5000) + 1000;
    }

    document.getElementById('link-movie-img').src = movieImg;
    document.getElementById('link-movie-title').innerText = movieTitle;

    // RENDER 5 SEASONS LOGIC
    let seasonsHtml = "";
    for(let i=1; i<=5; i++) {
        let audioLink = "";
        // Thử lấy link audio nếu có trong database
        if(movie && movie.seasons && movie.seasons[i-1] && movie.seasons[i-1].episodes && movie.seasons[i-1].episodes[0]) {
            audioLink = movie.seasons[i-1].episodes[0].audioUrl || "";
        }
        
        // Lọc bỏ file âm thanh mặc định bị trùng lặp
        if(audioLink === "https://files.catbox.moe/cikmvt.m4a") audioLink = "";
        
        // ----- BẮT ĐẦU: KHÔI PHỤC ÂM THANH GỐC CHO CÁC PHIM CŨ -----
        if (i === 1 && audioLink === "") {
            const fallbackMap = {
                'Hoa Khôi Đã Có Em Bé': "https://videotourl.com/audio/1779002003624-511d1962-2a5f-4662-8950-4727cecf00cb.m4a",
                'Điều Bí Ẩn Trong Truyền Thuyết': "https://videotourl.com/audio/1779001858015-891b7581-070f-446e-aa3a-d2a5b2ea4d0c.m4a",
                'Bạn Gái Gửi Nhờ Con Gái': "https://videotourl.com/audio/1778912532488-dbd61604-387a-4da9-ab25-2abec9ea9072.m4a",
                'Vợ Của Tôi Mắc Bệnh': "https://videotourl.com/audio/1778912384799-73c55bde-b0f0-4bcd-9ac0-d3fc0170c138.m4a",
                'Tôi Từ Bỏ Chị Mình': "https://videotourl.com/audio/1778820581886-8c11a88b-7f40-48c8-9b0c-93ddb7b8e7a8.m4a",
                'Bạn Gái Là Do Tôi Nhặt Được': "https://videotourl.com/audio/1778755421125-a8562e4e-e9ec-4e1d-9d76-34eb31461ff5.m4a",
                'Tôi Được Đưa Đến Cạnh Em': "https://videotourl.com/audio/1778683416286-6590e204-2ae2-45a9-9593-0baf5e08fce9.m4a",
                'Cứu Được Hoa Khôi Trường': "https://videotourl.com/audio/1778682831898-ac1e91a5-eac9-4bbb-b47d-dee171cfd1fb.m4a",
                'Đồ Quý Giá Của Tiểu Thư': "https://videotourl.com/audio/1778610249666-9aa58abd-fb64-4067-a0db-7fd57bc8f583.m4a",
                'Bám Lấy Bạn Gái Xã Hội': "https://videotourl.com/audio/1778456245230-085a9567-3bdb-4901-aabc-38a7c8620408.m4a",
                'Mẹ Tìm Người Dám Sát Tôi': "https://videotourl.com/audio/1778453856812-c4382dfb-9aa7-4c6a-bcea-099753158e25.m4a",
                'Đại Tiểu Thư Không Yêu Tôi': "https://videotourl.com/audio/1778257761898-f7cee7e2-d150-4b17-9e9c-5b703659ebd6.m4a",
                'Bố Giúp Tôi Lấy Con Gái Của Bạn': "https://videotourl.com/audio/1778257518578-f16225e8-48f0-4f7f-9d5a-a959eeabe872.m4a",
                'Hoa Khôi Quá Bám Tôi': "https://videotourl.com/audio/1778257224492-46d0d8a5-cdf5-44d1-97a3-32bb4ad85e87.m4a",
                'Tôi Kéo Được Tình Yêu Nhưng': "https://videotourl.com/audio/1777909664228-752aa7b4-f35c-40af-83ea-8c71887e5482.m4a",
                'Mập Mờ Với Con Thầy Giáo': "https://videotourl.com/audio/1777829654952-31035f14-1573-4de6-b998-4609f1d0387c.m4a",
                'Nghi Ngờ Bạn Gái Trọng Sinh': "https://videotourl.com/audio/1777829499456-5489afbf-69da-4148-8161-fb5d29d4f17b.m4a",
                'Bạn Gái Tôi Xinh Nhất': "https://videotourl.com/audio/1777829309308-30991d93-2434-4d3c-accf-e5156d6196cf.m4a",
                'Cô Bạn Gái Nói Dối Tô': "https://videotourl.com/audio/1777654118551-776f3635-5618-465a-8b2e-bd379f83997a.m4a",
                'Chuyến Tàu Đầy Định Mệnh': "https://videotourl.com/audio/1777563466161-9f448c73-e9d3-43b0-9f0b-beaddccd6771.m4a",
                'Tôi Đã Quên Vị Hôn Thê': "https://videotourl.com/audio/1777563294530-0941563f-74a5-45d5-b13c-aaa9d93adb44.m4a",
                'Hoa Khôi Mất Thính Lực': "https://videotourl.com/audio/1777323431832-c2b19ee8-57c8-42cb-9e79-ca841c4e67d5.m4a",
                'Bạn Gái Cố Tình Làm Tôi Ghen': "https://videotourl.com/audio/1777323290605-87694d97-70a3-41cb-a6ce-c5a4d70f5d67.m4a",
                'Cô Gái Tôi Cứu Ép Buộc Tôi': "https://videotourl.com/audio/1777207520610-91f0c7aa-d278-494f-8dae-59dc069061a4.m4a",
                'Quay Trở Lại Nhà Mình': "https://videotourl.com/audio/1777207384337-99a13b6f-ab3e-4f35-8aa0-feeda5303f0a.m4a",
                'Xem Bói Giúp Nữ Tổng Tài': "https://videotourl.com/audio/1777207234445-ae2ca984-94bc-450a-ba16-6c7b91708aab.m4a",
                'Anh Ấy Bỏ Tôi Mà Đi': "https://videotourl.com/audio/1777106025510-9b2d10aa-bdd8-4899-a57e-7a2a0e3948a4.m4a",
                'Em Bị Vào Tròng Rồi': "https://videotourl.com/audio/1776962266491-54fc6a82-42c4-456f-81d3-7dd8872a5cbb.m4a",
                'Bố Tôi Trả Góp Ô Tô': "https://videotourl.com/audio/1776864073703-bf183d4d-5218-4cb6-9da6-aae32bdae668.m4a",
                'Bài Kiểm Tra Của Thanh Mai': "https://files.catbox.moe/9g602v.m4a",
                'Mẹ Ra Lệnh Cho Tôi': "https://videotourl.com/audio/1776530460630-bd9245ca-6efb-4a34-b65a-da78024d2c2a.m4a",
                'Bố Và Mẹ Của Tôi Nhất': "https://videotourl.com/audio/1776432062804-f2b89215-56fc-4095-a140-b6d97124ac33.m4a",
                'Tôi Là Phản Diện Mạnh Nhất': "https://files.catbox.moe/zucqh3.m4a",
                'Bỏ Vợ Và Ra Đi': "https://videotourl.com/audio/1776262171928-8b43c1f4-f5e4-4408-8be4-2c9ea4363953.m4a",
                'Người Yêu Ngày Cha Qua Đời': "https://videotourl.com/audio/1776244432440-7a75ed7b-fb88-4b87-a2d3-e02ed389e09d.m4a",
                'Chặn Đầu Xe Ô Tô': "https://files.catbox.moe/7nchf3.m4a",
                'Chân Sai Vặt Của Họ': "https://videotourl.com/audio/1776160704336-d2bd4ada-a7a2-4be0-8f73-2f841d44a479.m4a",
                'Bạn Thân Người Yêu Cũ': "https://videotourl.com/audio/1776082105166-6c8a7cb4-ac2f-47ed-907c-6825925b9c04.m4a",
                'Hoán Đổi Thân Thế Rồi': "https://videotourl.com/audio/1776064995813-b41fff28-b39a-4a40-a480-fd5ebe0ba0a0.m4a",
                'Tôi Buổi Tối Hôm Đấy': "https://videotourl.com/audio/1776011213200-b173f4aa-dfa4-4031-aaa9-114dbef99e2b.m4a",
                'Ra Đi Để Giữ Lại': "https://pub-af59ef8bd16249ba9a926f943a92e17e.r2.dev/audio/1775982846211-a3c28bef-c8e5-4e63-bd70-db4ed76f1acd.m4a",
                'Sự Kiện Cho Đàn Ông': "https://files.catbox.moe/o68ce7.m4a",
                'Tôi Kháng Lại Tất Cả': "https://files.catbox.moe/kdw1b7.m4a",
                'Hoa Khôi Cố Gắng Tìm': "https://files.catbox.moe/xxi9wn.m4a",
                'Người Cuồng Em Trai Nhất': "https://files.catbox.moe/3a8mwe.m4a",
                'Chị Gái Của Tôi Mà': "https://files.catbox.moe/hlvkim.m4a",
                'Vợ Tôi Lạnh Lùng Quá': "https://files.catbox.moe/q3ey2e.m4a",
                'Ngày Bạn Gái Rời Đi': "https://files.catbox.moe/iu7pts.m4a",
                'Người Bố Chức Bí Mật': "https://files.catbox.moe/ucs440.m4a",
                'Các Chị Gái Của Tôi': "https://files.catbox.moe/4skfsa.m4a",
                'Hình Mẫu Của Tôi Đấy': "https://files.catbox.moe/obh6yf.m4a",
                'Gặp Gỡ Với Hoa Khôi': "https://files.catbox.moe/7y3ybi.m4a",
                'Rời Xa Khỏi Vợ Mình': "https://files.catbox.moe/oznaow.m4a",
                'Ngày Đầu Tôi Trở Về Nhà': "https://files.catbox.moe/0fdp29.m4a",
                'Cô Gái Tìm Kiếm Tôi': "https://files.catbox.moe/h59z4p.m4a",
                'Tôi Là Nỗi Sợ Hãi': "https://files.catbox.moe/785q30.m4a",
                'Lời Dạy Bảo Của Mẹ': "https://files.catbox.moe/w9ixrh.m4a",
                'Bạn Thân Của Chị Gái': "https://files.catbox.moe/ay2a8b.m4a",
                'Tôi Trở Thành Tỉ Phú': "https://files.catbox.moe/h4o7kp.m4a",
                'Ba Em Gái Của Tôi': "https://files.catbox.moe/es2ova.m4a",
                'Bạn Gái Cũ Chứng Minh': "https://files.catbox.moe/xxdgmx.m4a",
                'Tôi Cố Gắng Chịu Đựng': "https://files.catbox.moe/5hyn63.m4a",
                'Bài Mới Của Bạn Gái': "https://files.catbox.moe/mkhu1m.m4a",
                'Tiểu Thuyết Của Nam Chính': "https://files.catbox.moe/fu91o7.m4a",
                'Vợ Tổng Tài Của Tôi': "https://files.catbox.moe/ytmvfv.m4a",
                'Chấm Dứt Với Gia Đình': "https://files.catbox.moe/uz5ky7.m4a",
                'Cố Gắng Rời Xa Em': "https://files.catbox.moe/saltg1.m4a",
                'Chị Gái Nằm Với Tôi': "https://files.catbox.moe/nzldnc.m4a",
                'Cha Mẹ Bắt Tôi Về': "https://files.catbox.moe/sgv8s9.m4a",
                'Chị Gái Loại Bỏ Tôi': "https://files.catbox.moe/9qspdw.m4a",
                'Tôi Đã Bị Thay Thế': "https://files.catbox.moe/0ibes6.m4a",
                'So Tài Với Trà Xanh': "https://files.catbox.moe/mywlgy.m4a",
                'Bắt Nạt Cô Thanh Mai': "https://files.catbox.moe/prwwla.m4a",
                'Tôi Tránh Xa Thanh Mai': "https://files.catbox.moe/99ni7p.m4a",
                'Đã Thật Lòng Với': "https://files.catbox.moe/c5da2s.m4a",
                'Trợt Tỉnh Ra Sự Thật': "https://files.catbox.moe/69m56t.m4a",
                'Lấy Hoa Khôi Lạnh Lùng': "https://files.catbox.moe/2v33j0.m4a",
                'Nữ Thần Liễu Như Yên': "https://files.catbox.moe/gpnwng.m4a",
                'Tôi Nằm Trên Ván Cược': "https://files.catbox.moe/r433x2.m4a",
                'Tái Sinh Cùng Vợ Mình': "https://files.catbox.moe/csl5c0.m4a",
                'Không Cùng Thế Giới Mà': "https://files.catbox.moe/66zbhz.m4a",
                'Hoàn Hảo Với Em Gái': "https://files.catbox.moe/r1mu02.m4a",
                'Hẹn Hò Với Nữ Minh Tinh': "https://files.catbox.moe/3hfxx5.m4a",
                'Nấu Ăn Để Câu Cá': "https://files.catbox.moe/t56bql.m4a",
                'Bảo Vệ Mẹ Mình Khỏi': "https://files.catbox.moe/dxfojg.mp3",
                'Hôn Em Một Cái Thôi Mà': "https://files.catbox.moe/sv2cyf.m4a",
                'Họ Cứ Nghĩ Tôi Theo Em': "https://files.catbox.moe/8jw1g0.mp3",
                'Chuyển Tới Lớp Với Thanh Mai': "https://files.catbox.moe/cikmvt.m4a"
            };
            
            for (const [key, url] of Object.entries(fallbackMap)) {
                if (movieTitle.includes(key)) {
                    audioLink = url;
                    break;
                }
            }
        }
        // ----- KẾT THÚC KHÔI PHỤC ÂM THANH -----
        
        if(i === 1 || i === 2) {
            // SS1 và SS2: Nghe bình thường NẾU CÓ LINK THẬT, nếu không thì báo "Đang cập nhật"
            if(audioLink && audioLink.trim() !== "") {
                seasonsHtml += `<button class="ss-btn ss-btn-play" onclick="playAudioSeason('${audioLink}', '${movieTitle}', '${movieImg}', false)"><span><i class="fas fa-play-circle"></i> Phần ${i}</span> <span>Phát ngay</span></button>`;
            } else {
                seasonsHtml += `<button class="ss-btn ss-btn-update" onclick="showNotification('info', 'Thông Báo', 'Phần ${i} của phim này đang được cập nhật. Vui lòng quay lại sau!', 'Đã hiểu')"><span><i class="fas fa-tools"></i> Phần ${i}</span> <span>Đang cập nhật</span></button>`;
            }
        } else {
            // SS3, 4, 5: LUÔN KHÓA PREMIUM
            seasonsHtml += `<button class="ss-btn ss-btn-premium" onclick="playAudioSeason('${audioLink}', '${movieTitle}', '${movieImg}', true)"><span><i class="fas fa-crown"></i> Phần ${i}</span> <span>Khóa Premium</span></button>`;
        }
    }
    document.getElementById('lm-seasons-container').innerHTML = seasonsHtml;


    document.getElementById('link-modal-overlay').classList.add('show');
    setTimeout(() => { addHistoryEntry('watch', movieTitle, 'Đã xem', 0, movieImg); }, 50);
};

window.likeCurrentMovie = function() {
    let likedMovies = JSON.parse(localStorage.getItem('cnp_liked_movies')) || [];
    if(likedMovies.includes(window.currentMovieSlug)) {
        showNotification('info', 'Đã Thích', 'Bạn đã thích bộ phim này rồi!', 'Đóng');
        return;
    }
    
    let likesEl = document.getElementById('lm-likes-count');
    likesEl.innerText = parseInt(likesEl.innerText) + 1;
    likedMovies.push(window.currentMovieSlug);
    localStorage.setItem('cnp_liked_movies', JSON.stringify(likedMovies));
    
    fetch(`https://chunhatpham-online.onrender.com/api/movies/${window.currentMovieSlug}/like`, { method: 'POST' }).catch(e=>{});
    showNotification('success', 'Cảm ơn bạn', 'Đã thích bộ phim thành công!', 'Tuyệt');
};

window.shareCurrentMovie = function() {
    let shareUrl = window.location.origin + "?movie=" + window.currentMovieSlug;
    navigator.clipboard.writeText(shareUrl).then(() => {
        showNotification('success', 'Đã Sao Chép', 'Liên kết phim đã được lưu vào bộ nhớ tạm. Hãy chia sẻ cho bạn bè nhé!', 'Đóng');
    });
};

// ================= LOGIC TRÌNH PHÁT AUDIO CHUYÊN NGHIỆP =================
const webAudio = document.getElementById('main-web-audio');
const playBtn = document.getElementById('ap-play-btn');
const seekBar = document.getElementById('ap-seek-bar');
const currentTimeEl = document.getElementById('ap-current-time');
const totalTimeEl = document.getElementById('ap-total-time');

window.playAudioSeason = function(audioUrl, title, cover, isPremiumReq) {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    let isVip = currentUser && currentUser.isPremium;

    // 1. Kiểm tra yêu cầu Premium
    if(isPremiumReq && !isVip) {
        showNotification('warning', 'Yêu Cầu Nâng Cấp', 'Phần này chỉ dành riêng cho hội viên Premium. Vui lòng nâng cấp để nghe!', 'Nâng cấp ngay');
        openPremiumModal();
        return;
    }

    // 2. Chặn lỗi link trống ở các phần Premium
    if(isPremiumReq && (!audioUrl || !audioUrl.startsWith("http"))) {
        showNotification('info', 'Thông Báo', 'Phần này hiện đang được hoàn thiện. Vui lòng quay lại sau!', 'Đã hiểu');
        return;
    }

    // 4. PHÁT NHẠC
    if(audioUrl && audioUrl.startsWith("http")) {
        window.executeWithLoading(() => {
            document.getElementById('ap-cover-img').src = cover;
            document.getElementById('ap-movie-title').innerText = title;
            
            webAudio.src = audioUrl;
            webAudio.load();
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.classList.remove('playing');
            seekBar.value = 0;
            currentTimeEl.innerText = "00:00";
            
            // Hiển thị thanh Player dưới đáy
            document.getElementById('bottom-music-player').classList.add('show');
            let installBanner = document.getElementById('app-install-banner');
            if(installBanner && installBanner.style.display !== 'none') installBanner.style.bottom = window.innerWidth <= 768 ? '180px' : '130px';
            setTimeout(() => { togglePlayPause(); }, 300);
        }, 600);
    } else {
        showNotification('info', 'Thông Báo', 'Hệ thống đang cập nhật nội dung cho tác phẩm này. Vui lòng quay lại sau!', 'Đã hiểu');
    }
};

window.closeAudioPlayer = function() {
    document.getElementById('bottom-music-player').classList.remove('show');
    webAudio.pause(); 
    let installBanner = document.getElementById('app-install-banner');
    if(installBanner && installBanner.style.display !== 'none') installBanner.style.bottom = '20px';
};

function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    let m = Math.floor(seconds / 60);
    let s = Math.floor(seconds % 60);
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

window.togglePlayPause = function() {
    if (webAudio.paused) {
        let playPromise = webAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                playBtn.classList.add('playing');
            }).catch(error => {
                console.log("Audio load pending:", error);
                // Cho phép người dùng tự click nếu trình duyệt bắt buộc
            });
        }
    } else {
        webAudio.pause();
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.classList.remove('playing');
    }
};

window.skipAudio = function(seconds) {
    webAudio.currentTime += seconds;
};

let speeds = [1.0, 1.25, 1.5, 2.0];
let currentSpeedIdx = 0;
window.toggleAudioSpeed = function() {
    currentSpeedIdx = (currentSpeedIdx + 1) % speeds.length;
    let newSpeed = speeds[currentSpeedIdx];
    webAudio.playbackRate = newSpeed;
    document.getElementById('ap-speed-btn').innerText = newSpeed.toFixed(1) + "x";
};

window.toggleMute = function() {
    webAudio.muted = !webAudio.muted;
    const icon = document.querySelector('#ap-mute-btn i');
    if (webAudio.muted) {
        icon.className = 'fas fa-volume-mute';
        icon.style.color = '#e50914';
    } else {
        icon.className = 'fas fa-volume-up';
        icon.style.color = 'inherit';
    }
};

webAudio.addEventListener('timeupdate', () => {
    if (webAudio.duration) {
        let percentage = (webAudio.currentTime / webAudio.duration) * 100;
        seekBar.value = percentage;
        currentTimeEl.innerText = formatTime(webAudio.currentTime);
        seekBar.style.background = `linear-gradient(to right, #ff4e00 ${percentage}%, rgba(255,255,255,0.1) ${percentage}%)`;
    }
});

webAudio.addEventListener('loadedmetadata', () => {
    totalTimeEl.innerText = formatTime(webAudio.duration);
});

seekBar.addEventListener('input', () => {
    let seekTime = (seekBar.value / 100) * webAudio.duration;
    webAudio.currentTime = seekTime;
});

window.closeLinkModal = function() { document.getElementById('link-modal-overlay').classList.remove('show'); };
// Đã Xóa lệnh đóng khi ấn vào màn hình nền theo yêu cầu.
// Người dùng chỉ có thể đóng khi bấm vào nút 'X' ở góc.


// ================= AUTH, TÀI KHOẢN, MONGODB ĐĂNG KÝ VÀ ĐỒNG BỘ =================

// MỞ MODAL MUA GÓI TẮT QUẢNG CÁO ĐỘNG (Dùng JS tạo ra không cần sửa file HTML)
window.openBuyNoAdsModal = function() {
    if (!localStorage.getItem('cnp_current_user')) { showNotification('warning', 'Yêu Cầu', 'Đăng nhập để mua gói.', 'Đăng Nhập'); openTab('tab-account'); return; }
    
    let overlay = document.getElementById('no-ads-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'no-ads-modal-overlay';
        overlay.className = 'global-modal-overlay';
        overlay.innerHTML = `
            <div class="global-modal-box no-ads-modal-box">
                <button class="modal-close-icon" onclick="document.getElementById('no-ads-modal-overlay').classList.remove('show')"><i class="fas fa-times"></i></button>
                <div class="no-ads-header"><i class="fas fa-ad"></i><div class="slash-line"></div></div>
                <h2 style="color:white; margin-bottom:10px; font-size: 22px;">GÓI TẮT QUẢNG CÁO</h2>
                <p style="color:#aaa; font-size:14px; margin-bottom:20px;">Trải nghiệm xem phim mượt mà, bấm phát xem luôn không cần chờ đợi hay bị làm phiền bởi quảng cáo.</p>
                
                <div class="no-ads-info-box">
                    <div class="na-row"><i class="fas fa-check-circle"></i> Loại bỏ yêu cầu bấm quảng cáo 3 lần</div>
                    <div class="na-row"><i class="fas fa-check-circle"></i> Xem phim lập tức ngay cú click đầu</div>
                    <div class="na-row na-warning"><i class="fas fa-info-circle"></i> Không bao gồm các đặc quyền của gói Premium (Không có huy hiệu VIP, Không xem được phim khóa...)</div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.5); padding:15px; border-radius:12px; margin-bottom:25px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="text-align:left;">
                        <span style="color:#888; font-size:12px; display:block;">Thời hạn sử dụng</span>
                        <strong style="color:white; font-size:16px;">7 Ngày</strong>
                    </div>
                    <div style="text-align:right;">
                        <span style="color:#888; font-size:12px; display:block;">Mức giá</span>
                        <strong style="color:#00e676; font-size:22px; text-shadow:0 0 10px rgba(0,230,118,0.4);">20.000đ</strong>
                    </div>
                </div>

                <button class="btn-buy-noads" onclick="confirmBuyNoAds()"><i class="fas fa-shopping-cart"></i> THANH TOÁN NGAY</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) { if(e.target === this) this.classList.remove('show'); });
    }
    overlay.classList.add('show');
};

window.confirmBuyNoAds = function() {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    if (!currentUser) return;
    if (currentUser.isPremium) { showNotification('info', 'Không Cần Thiết', 'Tài khoản Premium đã mặc định không có quảng cáo!', 'Đóng'); return; }
    if (currentWalletBalance < 20000) { showNotification('error', 'Thất Bại', 'Số dư ví không đủ 20.000đ. Vui lòng nạp thêm!', 'Nạp Tiền'); document.getElementById('no-ads-modal-overlay').classList.remove('show'); openTab('tab-wallet'); return; }

    window.executeWithLoading(async () => {
        try {
            let res = await fetch('https://chunhatpham-online.onrender.com/api/user/buy-no-ads', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username })
            });
            let data = await res.json();
            if (res.ok) {
                currentUser.walletBalance = data.user.walletBalance;
                currentUser.noAdsExpiry = data.user.noAdsExpiry;
                localStorage.setItem('cnp_current_user', JSON.stringify(currentUser));
                window.updateAndSaveBalance(data.user.walletBalance);
                addHistoryEntry('spend', 'Mua Gói Tắt Quảng Cáo 7 Ngày', 20000, data.user.walletBalance);
                
                showNotification('success', 'Kích Hoạt Thành Công', 'Giờ đây bạn có thể xem phim ngay lập tức không bị làm phiền trong 7 ngày tới!', 'Tuyệt vời');
                document.getElementById('no-ads-modal-overlay').classList.remove('show');
                renderPremiumTabUI(); // Cập nhật lại UI profile
                syncPremiumUI(); // Cập nhật lại icon trên Header
            } else { showNotification('error', 'Thất Bại', data.message, 'Đóng'); }
        } catch (error) { showNotification('error', 'Lỗi Mạng', 'Không thể kết nối đến Máy chủ', 'Đóng'); }
    });
};

let currentWalletBalance = parseInt(localStorage.getItem('cnp_wallet_balance')) || 0;
let tempRegData = {};
let currentDepositType = ''; 
let pendingDepositAmount = 0;
let currentPremPrice = 70000;
let currentPremMonths = 1;
let currentPremTier = 'bronze';

// ================= QUAN TRỌNG: THÔNG TIN TẠO MÃ QR NẠP TIỀN TỰ ĐỘNG =================
// ĐỂ WEB CÓ THỂ NẠP TỰ ĐỘNG (KHÔNG BỊ TREO), BẠN BẮT BUỘC PHẢI ĐIỀN ĐÚNG 3 DÒNG DƯỚI ĐÂY:
// 1. Ngân hàng này PHẢI LÀ NGÂN HÀNG MÀ BẠN ĐÃ LIÊN KẾT VỚI SEPAY.
//    (Ví dụ: Nếu đăng ký SePay bằng Techcombank thì sửa "MB" thành "TCB", Vietcombank là "VCB", MB Bank là "MB")
const BANK_ID = "MSB"; 
// 2. Số tài khoản nhận tiền (Phải khớp với số TK đã đăng ký trên SePay)
const ACCOUNT_NO = "96886693012894"; 
// 3. Tên chủ tài khoản
const ACCOUNT_NAME = "DINH ANH CHANG"; 
let paymentCheckInterval = null; // Biến lưu trữ vòng lặp kiểm tra trạng thái

// 🔴 KÉO DỮ LIỆU TỪ MÁY CHỦ VỀ ĐỂ ĐẢM BẢO CHÍNH XÁC SỐ TIỀN KHÁCH ĐÃ NẠP 🔴
window.syncUserFromServer = async function() {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    if (!currentUser) return;
    try {
        let res = await fetch(`https://chunhatpham-online.onrender.com/api/user/${currentUser.username}`);
        if (res.ok) {
            let data = await res.json();
            localStorage.setItem('cnp_current_user', JSON.stringify(data));
            currentWalletBalance = data.walletBalance;
            localStorage.setItem('cnp_wallet_balance', currentWalletBalance);
            updateBalanceUI();
            if (typeof window.renderPremiumTabUI === 'function') window.renderPremiumTabUI();
            if (typeof window.syncPremiumUI === 'function') window.syncPremiumUI();
        }
    } catch (error) { console.error("Lỗi kéo dữ liệu Server:", error); }
};

function updateBalanceUI() {
    let mainWallet = document.getElementById('main-wallet-balance');
    let userWallet = document.getElementById('current-user-balance');
    if (mainWallet) mainWallet.innerText = currentWalletBalance.toLocaleString('vi-VN');
    if (userWallet) userWallet.innerText = currentWalletBalance.toLocaleString('vi-VN') + ' VNĐ';
}

// 🔴 CẬP NHẬT SỐ DƯ KÈM ĐỒNG BỘ MONGODB 🔴
window.updateAndSaveBalance = function(newBalance) {
    currentWalletBalance = newBalance;
    localStorage.setItem('cnp_wallet_balance', currentWalletBalance);
    updateBalanceUI();
    
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    if (currentUser) {
        currentUser.walletBalance = newBalance;
        localStorage.setItem('cnp_current_user', JSON.stringify(currentUser));
        // BỎ GỌI LÊN MÁY CHỦ VÌ NÓ SẼ GHI ĐÈ LÀM MẤT TIỀN NẠP THỦ CÔNG & AUTO BANK
    }
};

function checkAuthStatus() {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    if (currentUser) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('profile-section').style.display = 'block';
        document.getElementById('prof-username').innerText = currentUser.username;
        if(document.getElementById('prof-phone')) document.getElementById('prof-phone').value = currentUser.phone || '';
        if(document.getElementById('prof-email')) document.getElementById('prof-email').value = currentUser.email || '';
        document.getElementById('prof-ref').value = currentUser.refCode || 'Không có mã giới thiệu';
        
        let statusEl = document.getElementById('prof-tier-status');
        if(statusEl) {
            if(currentUser.isPremium) {
                let expDate = currentUser.premiumExpiry ? new Date(currentUser.premiumExpiry).toLocaleDateString('vi-VN') : 'Không giới hạn';
                statusEl.innerHTML = `Thành viên <span style="color: #f5c518; font-weight: bold;"><i class="fas fa-crown"></i> ${currentUser.premiumTier.toUpperCase()}</span> (HSD: ${expDate})`;
            } else {
                statusEl.innerHTML = `Thành viên hệ thống (Thường)`;
            }
        }
        
        updateAndSaveBalance(currentUser.walletBalance || 0);
        
        if(typeof window.renderHistoryUI === 'function') window.renderHistoryUI();
        if(typeof window.renderWalletOrders === 'function') window.renderWalletOrders();

        if(typeof window.renderPremiumTabUI === 'function') window.renderPremiumTabUI();
        if(typeof window.loadNotifications === 'function') window.loadNotifications();
        let adminItem = document.getElementById('menu-admin-item');
        if (adminItem) { 
            if (currentUser.role === 'admin') { adminItem.style.display = 'block'; if(typeof window.loadAdminData === 'function') window.loadAdminData(); } 
            else { adminItem.style.display = 'none'; } 
        }
    } else {
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('profile-section').style.display = 'none';
        let adminItem = document.getElementById('menu-admin-item'); if(adminItem) adminItem.style.display = 'none';
        document.getElementById('notif-badge').style.display = 'none';
        switchAuthTab('login');
    }
}

window.switchAuthTab = function(tab) {
    document.getElementById('tab-btn-login').classList.remove('active');
    document.getElementById('tab-btn-register').classList.remove('active');
    document.getElementById('form-login').style.display = 'none';
    document.getElementById('form-register').style.display = 'none';
    document.getElementById('form-set-username').style.display = 'none';
    if (tab === 'login') { document.getElementById('tab-btn-login').classList.add('active'); document.getElementById('form-login').style.display = 'block'; } 
    else { document.getElementById('tab-btn-register').classList.add('active'); document.getElementById('form-register').style.display = 'block'; }
};

// 🔴 ĐĂNG NHẬP BẰNG SERVER THẬT 🔴
window.handleLogin = async function() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!username || !password) {
        showNotification('warning', 'Thiếu Thông Tin', 'Vui lòng nhập Tên tài khoản và Mật khẩu!', 'Đã hiểu');
        return;
    }

    window.executeWithLoading(async () => {
        try {
            const response = await fetch('https://chunhatpham-online.onrender.com/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('cnp_current_user', JSON.stringify(data.user));
                showNotification('success', 'Đăng Nhập Thành Công', data.message, 'Vào trang chủ');
                document.getElementById('login-username').value = '';
                document.getElementById('login-password').value = '';
                checkAuthStatus();
                syncPremiumUI();
            } else {
                showNotification('error', 'Lỗi Đăng Nhập', data.message, 'Thử lại');
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotification('error', 'Hệ Thống Đang Ngủ', 'Máy chủ đang khởi động lại. Vui lòng đợi khoảng 1 phút rồi bấm Đăng Nhập lại nhé!', 'Đã hiểu');
        }
    }, 600);
};

window.handleRegisterStep1 = function() {
    let phone = document.getElementById('reg-phone').value.trim();
    let email = document.getElementById('reg-email').value.trim();
    let pw = document.getElementById('reg-password').value.trim();
    let pwConfirm = document.getElementById('reg-confirm-password').value.trim();
    let refCode = document.getElementById('reg-refcode').value.trim();
    
    if (!phone || !email || !pw || !pwConfirm) { showNotification('warning', 'Thiếu Thông Tin', 'Vui lòng điền đầy đủ thông tin!', 'Đã hiểu'); return; }
    let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let phoneRegex = /^(0|84)(3|5|7|8|9)[0-9]{8}$/; 
    
    if (!phoneRegex.test(phone)) { showNotification('error', 'Sai Định Dạng', 'Vui lòng nhập chính xác Số điện thoại (10 số)!', 'Sửa lại'); return; }
    if (!emailRegex.test(email)) { showNotification('error', 'Sai Định Dạng', 'Vui lòng nhập chính xác Địa chỉ Email!', 'Sửa lại'); return; }
    if (pw !== pwConfirm) { showNotification('error', 'Lỗi Mật Khẩu', 'Xác nhận mật khẩu không khớp!', 'Nhập lại'); return; }
    
    tempRegData = { phone: phone, email: email, password: pw, refCode: refCode, walletBalance: 0 };
    document.getElementById('form-register').style.display = 'none';
    let step2 = document.getElementById('form-set-username');
    step2.style.display = 'block'; step2.classList.remove('success-pop'); void step2.offsetWidth; step2.classList.add('success-pop');
    document.getElementById('tab-btn-register').innerText = "BƯỚC 2: TẠO TÊN";
};

window.rollRandomUsername = function() {
    const prefixes = ["Hacker", "Vip", "Pro", "Master", "Dark", "Light", "Phim", "Anime", "God", "Super"];
    const suffixes = ["Player", "Lord", "King", "Queen", "Knight", "Hunter", "Ghost", "Ninja", "Boy", "Girl"];
    const randChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newName = "";
    if(Math.random() > 0.3) { newName = prefixes[Math.floor(Math.random() * prefixes.length)] + suffixes[Math.floor(Math.random() * suffixes.length)] + (Math.floor(Math.random() * 999) + 1); } 
    else { newName = "CNP_"; for(let i=0; i<5; i++) newName += randChars.charAt(Math.floor(Math.random() * randChars.length)); }
    let inputField = document.getElementById('reg-username'); inputField.value = newName;
    inputField.style.transform = 'scale(1.1)'; inputField.style.borderColor = '#f5c518';
    setTimeout(() => { inputField.style.transform = 'scale(1)'; inputField.style.borderColor = '#00c6ff'; }, 250);
};

// 🔴 NÚT GỬI ĐĂNG KÝ LÊN SERVER MONGODB 🔴
window.handleRegisterFinal = async function() {
    let un = document.getElementById('reg-username').value.trim();
    if (!un) { showNotification('warning', 'Chưa Nhập Tên', 'Bạn phải tạo Tên Tài Khoản!', 'Đã hiểu'); return; }
    if (!tempRegData.phone || !tempRegData.email) { showNotification('error', 'Lỗi Dữ Liệu', 'Dữ liệu đăng ký bị mất do bạn vừa tải lại trang. Vui lòng F5 tải lại và làm lại từ Bước 1 nhé!', 'Đã hiểu'); return; }
    
    // Chống lỗi bấm nút 2 lần liên tục (Double-click) sinh ra lỗi E11000 ảo
    let regBtn = document.querySelector('#form-set-username .auth-btn');
    if (regBtn.style.pointerEvents === 'none') return;
    regBtn.style.pointerEvents = 'none';

    window.executeWithLoading(async () => {
        try {
            const response = await fetch('https://chunhatpham-online.onrender.com/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: tempRegData.phone,
                    email: tempRegData.email,
                    password: tempRegData.password, 
                    username: un
                })
            });

            const data = await response.json();

            if (response.ok) {
                // ĐĂNG KÝ THÀNH CÔNG & TỰ ĐỘNG ĐĂNG NHẬP
                localStorage.setItem('cnp_current_user', JSON.stringify(data.user));
                
                showNotification('success', 'Đăng Ký Thành Công', `Chào mừng ${data.user.username}! Bạn đã được tự động đăng nhập.`, 'Bắt đầu khám phá');
                
                // Reset các trường input và giao diện
                if(document.getElementById('reg-phone')) document.getElementById('reg-phone').value = ''; 
                if(document.getElementById('reg-email')) document.getElementById('reg-email').value = ''; 
                document.getElementById('reg-password').value = ''; 
                document.getElementById('reg-confirm-password').value = ''; 
                document.getElementById('reg-refcode').value = ''; 
                document.getElementById('reg-username').value = '';
                document.getElementById('tab-btn-register').innerText = "ĐĂNG KÝ";
                tempRegData = {}; // Xóa sạch dữ liệu bộ nhớ đệm

                // Cập nhật giao diện sang trạng thái đã đăng nhập
                checkAuthStatus();
                syncPremiumUI();
            } else {
                if (data.message === "Lỗi hệ thống máy chủ!") {
                    showNotification('error', 'Lỗi Đám Mây (Render.com)', 'CẢNH BÁO: Máy chủ Render của bạn đang bị kẹt ở bản code cũ. Vui lòng đăng nhập vào web Render.com, chọn Manual Deploy -> Clear build cache & deploy để khởi động lại máy chủ!', 'Đã hiểu');
                } else if (data.message.includes("E11000")) {
                    showNotification('error', 'Trùng Dữ Liệu', 'Email hoặc SĐT này đã từng được đăng ký trong hệ thống. Vui lòng thử tạo tài khoản bằng một SĐT và Email hoàn toàn mới (VD: test12345@gmail.com - 0399887766).', 'Thử lại');
                } else {
                    showNotification('error', 'Lỗi Đăng Ký', "Chi tiết từ Server: " + data.message, 'Đã hiểu');
                }
            }
        } catch (error) {
            console.error('Register error:', error);
            showNotification('error', 'Hệ Thống Đang Ngủ', 'Máy chủ đang khởi động lại. Vui lòng đợi khoảng 1 phút rồi bấm Đăng Ký lại nhé!', 'Đã hiểu');
        }
        // Mở khóa lại nút bấm
        regBtn.style.pointerEvents = 'auto';
    }, 800);
};

window.handleLogout = function() {
    localStorage.removeItem('cnp_current_user');
    syncPremiumUI();
    if(document.getElementById('main-wallet-balance')) document.getElementById('main-wallet-balance').innerText = '0';
    if(document.getElementById('current-user-balance')) document.getElementById('current-user-balance').innerText = '0 VNĐ';
    showNotification('success', 'Đăng Xuất', 'Bạn đã đăng xuất an toàn.', 'Đóng');
    checkAuthStatus();
};

// ================= DEPOSIT LOGIC =================
window.openDepositModal = function() {
    if (!localStorage.getItem('cnp_current_user')) { showNotification('warning', 'Yêu Cầu', 'Đăng nhập để nạp tiền.', 'Đăng Nhập'); openTab('tab-account'); return; }
    let depInput = document.getElementById('deposit-amount'); if(depInput) depInput.value = ''; 
    document.querySelectorAll('.quick-btn').forEach(btn => btn.classList.remove('active'));
    let depTitle = document.getElementById('dep-title'); if(depTitle) depTitle.innerHTML = '<i class="fas fa-wallet"></i> Nhập Số Tiền Cần Nạp';
    window.checkAmount(); 
    let depModal = document.getElementById('deposit-modal-overlay'); if(depModal) depModal.classList.add('show');
};

window.closeDepositModal = function() { document.getElementById('deposit-modal-overlay').classList.remove('show'); };
window.setAmount = function(amount) { let depInput = document.getElementById('deposit-amount'); if(depInput) depInput.value = amount; document.querySelectorAll('.quick-btn').forEach(btn => btn.classList.remove('active')); if(event && event.target) event.target.classList.add('active'); window.checkAmount(); };

window.checkAmount = function() {
    let val = parseInt(document.getElementById('deposit-amount').value) || 0;
    let btnConfirmDep = document.getElementById('btn-confirm-dep'); let warningBox = document.getElementById('deposit-warning-box');
    if(val >= 10000) { 
        if(btnConfirmDep) { btnConfirmDep.style.opacity = '1'; btnConfirmDep.style.pointerEvents = 'auto'; }
        if(warningBox) warningBox.classList.add('show');
    } else { 
        if(btnConfirmDep) { btnConfirmDep.style.opacity = '0.5'; btnConfirmDep.style.pointerEvents = 'none'; }
        if(warningBox) warningBox.classList.remove('show');
    }
};

window.confirmDeposit = function() {
    window.pendingDepositAmount = parseInt(document.getElementById('deposit-amount').value) || 0; 
    window.closeDepositModal(); 
    
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    if(!currentUser) return;

    // CÚ PHÁP CHUYỂN KHOẢN: NAP SĐT
    const transferContent = `NAP ${currentUser.phone}`; 
    
    // TẠO ĐƠN NẠP TRẠNG THÁI "ĐANG CHỜ"
    window.currentOrderId = Date.now();
    let ordersKey = getHistoryKey('orders');
    let orders = JSON.parse(localStorage.getItem(ordersKey)) || [];
    orders.unshift({ id: window.currentOrderId, amount: window.pendingDepositAmount, status: 'pending', time: new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) + ' - ' + new Date().toLocaleDateString('vi-VN') });
    if(orders.length > 20) orders.pop();
    localStorage.setItem(ordersKey, JSON.stringify(orders));
    renderWalletOrders();

    // TẠO ẢNH QR ĐỘNG TỪ SEPAY API DÀNH RIÊNG CHO TÀI KHOẢN ẢO (VA)
    const qrUrl = `https://qr.sepay.vn/img?acc=${ACCOUNT_NO}&bank=${BANK_ID}&amount=${window.pendingDepositAmount}&des=${encodeURIComponent(transferContent)}`;

    let otpModal = document.getElementById('otp-modal-overlay'); 
    let otpBox = document.querySelector('.otp-modal-box');

    // Thay đổi giao diện Modal OTP cũ thành Modal Quét QR Chờ Thanh Toán
    otpBox.innerHTML = `
        <button class="otp-close" onclick="closeOtpModal()"><i class="fas fa-times"></i></button>
        <div class="otp-title"><i class="fas fa-bolt"></i> THANH TOÁN TỰ ĐỘNG</div>
        <p style="color: #ccc; margin-bottom: 15px; font-size: 14px;">Quét mã QR bằng App ngân hàng để nạp tiền.</p>
        
        <div style="background: white; padding: 10px; border-radius: 15px; margin-bottom: 20px; display: inline-block;">
            <img src="${qrUrl}" alt="VietQR" style="width: 200px; height: 200px; object-fit: contain;">
        </div>
        
        <div style="background: rgba(0,0,0,0.5); border: 1px dashed rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; text-align: left; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span style="color:#aaa;">Ngân hàng:</span> 
                <strong style="color: white;">${BANK_ID}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span style="color:#aaa;">Số tài khoản:</span> 
                <strong style="color: white;">${ACCOUNT_NO}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span style="color:#aaa;">Số tiền:</span> 
                <strong style="color: #00e676; font-size: 16px;">${window.pendingDepositAmount.toLocaleString('vi-VN')} đ</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color:#aaa;">Nội dung (BẮT BUỘC):</span> 
                <strong style="color: #f5c518; letter-spacing: 1px;">${transferContent} <i class="fas fa-copy" style="cursor:pointer;" onclick="copyText('copy-content-hidden', '${transferContent}')"></i></strong>
                <span id="copy-content-hidden" style="display:none;">${transferContent}</span>
            </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; color: #00c6ff; background: rgba(0, 198, 255, 0.1); padding: 10px; border-radius: 8px;">
            <i class="fas fa-spinner fa-spin"></i> <span style="font-weight: bold;">Hệ thống đang chờ nhận tiền... (Tối đa 5 phút)</span>
        </div>
    `;

    if(otpModal) otpModal.classList.add('show');

    // BẮT ĐẦU VÒNG LẶP KIỂM TRA TRẠNG THÁI THANH TOÁN MỖI 3 GIÂY
    const currentBalance = currentUser.walletBalance || 0;
    if(paymentCheckInterval) clearInterval(paymentCheckInterval);
    
    let timeWaited = 0;
    const MAX_WAIT_TIME = 300000;

    paymentCheckInterval = setInterval(async () => {
        try {
            timeWaited += 3000;
            if (timeWaited >= MAX_WAIT_TIME) {
                clearInterval(paymentCheckInterval);
                window.closeOtpModal();
                showNotification('info', 'Giao Dịch Đang Xử Lý', 'Giao dịch của bạn có thể mất thêm vài phút. Vui lòng kiểm tra Lịch Sử Giao Dịch sau ít phút.', 'Tôi Đã Hiểu');
                return;
            }

            const response = await fetch(`https://chunhatpham-online.onrender.com/api/user/${currentUser.username}`);
            const data = await response.json();

            if (response.ok && data && data.walletBalance > currentBalance) {
                clearInterval(paymentCheckInterval);
                window.closeOtpModal();
                
                // Cập nhật lại toàn bộ cục data user (bao gồm cả trạng thái premium nếu có cập nhật) từ server
                localStorage.setItem('cnp_current_user', JSON.stringify(data));
                
                window.updateAndSaveBalance(data.walletBalance);
                
                // CẬP NHẬT ĐƠN THÀNH CÔNG
                if(window.currentOrderId) {
                    let oList = JSON.parse(localStorage.getItem(ordersKey)) || [];
                    let o = oList.find(x => x.id === window.currentOrderId);
                    if(o) { o.status = 'success'; localStorage.setItem(ordersKey, JSON.stringify(oList)); }
                    window.currentOrderId = null;
                    renderWalletOrders();
                }
                addHistoryEntry('deposit', 'Nạp Tiền Tự Động', data.walletBalance - currentBalance, data.walletBalance);
                
                let successModal = document.getElementById('deposit-success-overlay'); 
                let amountText = document.getElementById('success-amount-text');
                if(amountText) amountText.innerText = `+ ${(data.walletBalance - currentBalance).toLocaleString('vi-VN')} VNĐ đã được cộng vào ví`;
                if(successModal) successModal.classList.add('show');
            }
        } catch (error) {
            console.error("Lỗi kiểm tra thanh toán:", error);
        }
    }, 3000); // 3000ms = 3 giây kiểm tra 1 lần
};

window.closeOtpModal = function() { 
    let otpModal = document.getElementById('otp-modal-overlay'); 
    if(otpModal) otpModal.classList.remove('show'); 
    if(paymentCheckInterval) clearInterval(paymentCheckInterval); 
    
    // NẾU KHÁCH TẮT BẢNG QR TRƯỚC KHI CÓ TIỀN VÀO -> BÁO ĐÃ HỦY ĐƠN
    if(window.currentOrderId) {
        let ordersKey = getHistoryKey('orders');
        let oList = JSON.parse(localStorage.getItem(ordersKey)) || [];
        let o = oList.find(x => x.id === window.currentOrderId);
        if(o && o.status === 'pending') { o.status = 'cancelled'; localStorage.setItem(ordersKey, JSON.stringify(oList)); renderWalletOrders(); }
        window.currentOrderId = null;
    }
};
document.getElementById('otp-modal-overlay').addEventListener('click', function(e) { if(e.target === this) window.closeOtpModal(); });

window.closeSuccessCelebration = function() { let successModal = document.getElementById('deposit-success-overlay'); if(successModal) successModal.classList.remove('show'); };
window.copyText = function(id) { let text = document.getElementById(id).innerText; navigator.clipboard.writeText(text).then(() => showNotification('success', 'Đã Copy', text, 'Đóng')); };

// ================= PREMIUM & PAYMENT =================
window.openPremiumModal = function() {
    if (!localStorage.getItem('cnp_current_user')) { showNotification('warning', 'Yêu Cầu', 'Đăng nhập để nâng cấp Premium!', 'Đăng Nhập'); openTab('tab-account'); return; }
    document.getElementById('premium-modal').classList.add('show');
};
window.closePremiumModal = function() { document.getElementById('premium-modal').classList.remove('show'); };

window.selectPrem = function(el, m, p, tier) {
    // Dùng cho Popup Modal ở trang chủ (cũ)
    document.querySelectorAll('.prem-card').forEach(c => c.classList.remove('active')); el.classList.add('active');
    currentPremPrice = p; currentPremMonths = m; currentPremTier = tier;
    document.getElementById('prem-sum').innerHTML = `Thanh toán: <span style="color: #f5c518;">${p.toLocaleString('vi-VN')}đ</span>`;
};

window.selectPremiumTabPlan = function(el, m, p, tier) {
    // Dùng cho Trang Premium mới
    document.querySelectorAll('.p-plan-card').forEach(c => c.classList.remove('active')); el.classList.add('active');
    currentPremPrice = p; currentPremMonths = m; currentPremTier = tier;
    document.getElementById('pt-price-display').innerText = p.toLocaleString('vi-VN') + 'đ';
};

window.renderPremiumTabUI = function() {
    let board = document.getElementById('premium-status-board');
    if(!board) return;
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    
    if(!currentUser) {
        board.innerHTML = `<div style="text-align:center; width:100%;"><p style="color:#aaa;">Vui lòng đăng nhập để xem trạng thái hội viên của bạn.</p><button class="auth-btn" style="width: auto; padding: 10px 20px; margin: 15px auto 0; font-size: 14px;" onclick="openTab('tab-account')">Đăng Nhập Ngay</button></div>`;
        return;
    }

    if(currentUser.isPremium) {
        let daysLeft = '∞';
        if (currentUser.premiumExpiry) {
            let diffTime = Math.abs(new Date(currentUser.premiumExpiry) - new Date());
            daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        }
        let tierColor = currentUser.premiumTier === 'diamond' ? '#00f2ff' : (currentUser.premiumTier === 'gold' ? '#f5c518' : (currentUser.premiumTier === 'silver' ? '#e0e0e0' : '#cd7f32'));
        
        board.innerHTML = `
            <div class="ps-left">
                <div class="ps-avatar is-vip" style="border-color:${tierColor}; color:${tierColor};"><i class="fas fa-crown"></i></div>
                <div class="ps-info"><h3>${currentUser.username}</h3><p>Đang sử dụng thẻ <span class="ps-tier-name" style="color:${tierColor};">${currentUser.premiumTier}</span></p><p style="margin-top:5px; font-size:12px; color:#00e676;"><i class="fas fa-ad"></i> Miễn phí Tắt Quảng Cáo</p></div>
            </div>
            <div class="ps-right"><h4>Thời gian còn lại</h4><div class="ps-days-left active">${daysLeft} <span>ngày</span></div></div>
        `;
    } else {
        let hasNoAds = currentUser.noAdsExpiry && new Date(currentUser.noAdsExpiry) > new Date();
        let noAdsStatus = hasNoAds 
            ? `<span style="color:#00e676; font-size:12px;"><i class="fas fa-check-circle"></i> Đã Tắt Q.Cáo (Còn ${Math.ceil(Math.abs(new Date(currentUser.noAdsExpiry) - new Date()) / (1000*60*60*24))} ngày)</span>` 
            : `<span style="color:#aaa; font-size:12px;">Đang có quảng cáo</span> <button onclick="openBuyNoAdsModal()" style="background:linear-gradient(45deg, #e50914, #ff4e00); color:white; border:none; padding:4px 10px; border-radius:15px; cursor:pointer; font-size:11px; font-weight:bold; margin-left:8px; box-shadow:0 2px 8px rgba(229,9,20,0.4);"><i class="fas fa-ban"></i> TẮT NGAY (20k)</button>`;

        board.innerHTML = `
            <div class="ps-left">
                <div class="ps-avatar"><i class="fas fa-user"></i></div>
                <div class="ps-info"><h3>${currentUser.username}</h3><p>Trạng thái: <span class="ps-tier-name" style="color:#aaa;">Thành viên Thường</span></p><div style="margin-top:6px; display:flex; align-items:center;">${noAdsStatus}</div></div>
            </div>
            <div class="ps-right"><h4>Trạng thái đặc quyền</h4><div class="ps-days-left" style="color:#ff4e00;">ĐÃ KHÓA</div></div>
        `;
    }
};

window.confirmPurchasePremium = function() {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user')); let balance = currentUser.walletBalance || 0;
    if (balance < currentPremPrice) { showNotification('error', 'Thất Bại', 'Số dư ví không đủ. Vui lòng nạp thêm!', 'Nạp Tiền'); closePremiumModal(); openTab('tab-wallet'); return; }
    
    window.executeWithLoading(async () => {
        try {
            let res = await fetch('https://chunhatpham-online.onrender.com/api/user/buy-premium', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username, months: currentPremMonths, price: currentPremPrice, tier: currentPremTier })
            });
            
            let data = await res.json();
            if (res.ok) {
                // Cập nhật LocalStorage với thông tin mới từ Server
                currentUser.walletBalance = data.user.walletBalance;
                currentUser.isPremium = data.user.isPremium;
                currentUser.premiumTier = data.user.premiumTier;
                currentUser.premiumExpiry = data.user.premiumExpiry;
                localStorage.setItem('cnp_current_user', JSON.stringify(currentUser));
                
                window.updateAndSaveBalance(data.user.walletBalance);
                addHistoryEntry('spend', 'Mua Gói Premium ' + currentPremMonths + ' Tháng', currentPremPrice, data.user.walletBalance);
                
                showNotification('success', 'Tuyệt Vời', `Bạn đã nâng cấp Premium thành công! Thời hạn sử dụng đã được cộng dồn.`, 'Trải nghiệm'); 
                closePremiumModal(); 
                checkAuthStatus(); // Update UI profile
                syncPremiumUI();
            } else { showNotification('error', 'Thất Bại', data.message, 'Đóng'); }
        } catch (error) { showNotification('error', 'Lỗi Mạng', 'Không thể kết nối đến Máy chủ', 'Đóng'); }
    });
};

window.syncPremiumUI = function() {
    let user = JSON.parse(localStorage.getItem('cnp_current_user')); let crown = document.getElementById('header-crown-status'); let heroBtn = document.getElementById('main-premium-btn');
    if (user && user.isPremium) {
        if(crown) { crown.style.display = 'inline-block'; crown.className = 'fas fa-crown crown-' + user.premiumTier; }
        if(heroBtn) { heroBtn.classList.add('is-active'); heroBtn.innerHTML = '<i class="fas fa-check-circle"></i> Đã Kích Hoạt Premium'; }
    } else {
        if(crown) crown.style.display = 'none';
        if(heroBtn) { heroBtn.classList.remove('is-active'); heroBtn.innerHTML = '<i class="fas fa-crown"></i> Nâng Cấp Premium'; }
    }
        
        if (typeof window.updateHeaderNoAdsBtn === 'function') window.updateHeaderNoAdsBtn();
    };

window.updateHeaderNoAdsBtn = function() {
    let headerRight = document.querySelector('.header-right');
    if(!headerRight) return;
    
    let noAdsBtn = document.getElementById('header-no-ads-btn');
    if(!noAdsBtn) {
        noAdsBtn = document.createElement('div');
        noAdsBtn.id = 'header-no-ads-btn';
        noAdsBtn.className = 'header-no-ads-btn';
        noAdsBtn.innerHTML = '<i class="fas fa-bullhorn"></i><div class="ban-line"></div>';
        noAdsBtn.onclick = window.openBuyNoAdsModal;
        
        let notifBell = document.querySelector('.notification-wrapper');
        if(notifBell) headerRight.insertBefore(noAdsBtn, notifBell);
        else headerRight.prepend(noAdsBtn);
    }
    
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    let isVip = currentUser && currentUser.isPremium;
    let hasNoAdsPack = currentUser && currentUser.noAdsExpiry && (new Date(currentUser.noAdsExpiry) > new Date());
    
    if (isVip || hasNoAdsPack) {
        noAdsBtn.classList.add('active-no-ads'); noAdsBtn.title = "Đã tắt quảng cáo";
    } else {
        noAdsBtn.classList.remove('active-no-ads'); noAdsBtn.title = "Tắt quảng cáo (20k/7 ngày)";
    }
};

let currentBasePrice = 0; let finalPrice = 0;
window.openPaymentModal = function(pkg, price) { 
    if (!localStorage.getItem('cnp_current_user')) { showNotification('warning', 'Yêu Cầu Đăng Nhập', 'Vui lòng đăng nhập để mua gói.', 'Đăng Nhập'); openTab('tab-account'); return; }
    currentBasePrice = price; document.getElementById('pay-package-name').innerText = pkg; document.querySelector('.dur-card').click(); document.getElementById('payment-modal-overlay').classList.add('show'); 
};
window.closePaymentModal = function() { document.getElementById('payment-modal-overlay').classList.remove('show'); };
window.selectDuration = function(el, m, disc) { document.querySelectorAll('.dur-card').forEach(c => c.classList.remove('active')); el.classList.add('active'); finalPrice = currentBasePrice * m * ((100-disc)/100); document.getElementById('pay-total-price').innerText = finalPrice.toLocaleString('vi-VN') + 'đ'; };

window.processPayment = function() {
    closePaymentModal();
    setTimeout(() => {
        if(currentWalletBalance >= finalPrice) {
            let pkgName = document.getElementById('pay-package-name').innerText;
            addHistoryEntry('spend', pkgName, finalPrice, currentWalletBalance - finalPrice);
            window.updateAndSaveBalance(currentWalletBalance - finalPrice); // ĐỒNG BỘ SERVER
            showNotification('success', 'Thành Công', 'Đã mua gói Server thành công.', 'Xem ngay');
        } else { showNotification('error', 'Thất Bại', 'Số dư không đủ!', 'Đã hiểu'); }
    }, 300);
};

// ================= HISTORY LOGIC =================
// Hàm phụ trợ tạo Key riêng cho từng Tài Khoản
window.getHistoryKey = function(prefix) {
    let user = JSON.parse(localStorage.getItem('cnp_current_user'));
    return user ? `cnp_${prefix}_${user.username}` : `cnp_${prefix}_guest`;
};

window.addHistoryEntry = function(type, title, amountOrExtra, balanceAfter = 0, imgSrc = '') {
    let key = getHistoryKey('history');
    let history = JSON.parse(localStorage.getItem(key)) || [];
    if (type === 'watch') history = history.filter(item => item.title !== title);
    const newEntry = { id: Date.now(), type: type, title: title, time: (new Date()).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) + ' - ' + (new Date()).toLocaleDateString('vi-VN'), amountOrExtra: amountOrExtra, balanceAfter: balanceAfter, imgSrc: imgSrc };
    history.unshift(newEntry); if (history.length > 50) history.pop(); localStorage.setItem(key, JSON.stringify(history));
    if(typeof renderHistoryUI === 'function') renderHistoryUI();
};

window.renderWalletOrders = function() {
    let container = document.getElementById('wallet-history-list');
    if(!container) return;
    let orders = JSON.parse(localStorage.getItem(getHistoryKey('orders'))) || [];
    if(orders.length === 0) { container.innerHTML = '<p style="text-align:center; color:#888; padding: 20px;">Bạn chưa tạo đơn nạp nào.</p>'; return; }
    
    let html = '';
    orders.forEach(o => {
        let stClass = o.status === 'success' ? 'st-success' : (o.status === 'cancelled' ? 'st-cancelled' : 'st-pending');
        let stText = o.status === 'success' ? 'Thành công' : (o.status === 'cancelled' ? 'Đã hủy' : 'Chờ thanh toán');
        let icon = o.status === 'success' ? 'fa-check' : (o.status === 'cancelled' ? 'fa-times' : 'fa-spinner fa-spin');
        html += `<div class="order-item">
            <div class="o-left"><span class="o-amount">+ ${o.amount.toLocaleString('vi-VN')} đ</span><span class="o-time">${o.time}</span></div>
            <div class="o-status ${stClass}"><i class="fas ${icon}"></i> ${stText}</div>
        </div>`;
    });
    container.innerHTML = html;
};

window.renderHistoryUI = function() {
    const container = document.getElementById('main-history-list'); if (!container) return;
    let history = JSON.parse(localStorage.getItem(getHistoryKey('history'))) || [];
    if (history.length === 0) { container.innerHTML = '<p style="text-align:center; color:#888; padding: 30px; font-style: italic;">Bạn chưa có hoạt động nào gần đây.</p>'; return; }
    let html = '';
    history.forEach((item, index) => {
        let delay = (index * 0.05) > 1 ? 0 : (index * 0.05);
        if (item.type === 'watch') {
            let coverImg = item.imgSrc ? item.imgSrc : 'https://i.postimg.cc/BZTQdwdb/56575EA9-6C1E-453E-A0EE-628BF972D3E7.png';
            html += `<div class="history-item type-watch" style="animation-delay: ${delay}s;" onclick="openPlayer('${item.title}')">
                <div class="hist-left"><div class="hist-img-preview"><img src="${coverImg}" alt="${item.title}"></div><div class="hist-details"><span class="hist-title">${item.title}</span><span class="hist-time"><i class="fas fa-headphones" style="color: #f5c518;"></i> ${item.amountOrExtra} • <i class="far fa-clock"></i> ${item.time}</span></div></div>
                <div class="hist-right"><div class="hist-val-watch" style="color: var(--primary-color); border-color: var(--primary-color); font-weight: bold; background: rgba(229,9,20,0.1);"><i class="fas fa-play-circle"></i> Xem Lại</div></div>
            </div>`;
        } else {
            let iconClass = item.type === 'deposit' ? 'icon-deposit' : 'icon-spend'; let iconFas = item.type === 'deposit' ? 'fa-money-check-alt' : 'fa-shopping-cart'; let valClass = item.type === 'deposit' ? 'hist-val-plus' : 'hist-val-minus'; let prefix = item.type === 'deposit' ? '+' : '-';
            html += `<div class="history-item type-transaction" style="animation-delay: ${delay}s;">
                <div class="hist-left"><div class="hist-icon ${iconClass}"><i class="fas ${iconFas}"></i></div><div class="hist-details"><span class="hist-title">${item.title}</span><span class="hist-time"><i class="far fa-clock"></i> ${item.time}</span></div></div>
                <div class="hist-right"><div class="${valClass}">${prefix} ${item.amountOrExtra.toLocaleString('vi-VN')}đ</div><div class="hist-balance-after">Số dư: ${item.balanceAfter.toLocaleString('vi-VN')}đ</div></div>
            </div>`;
        }
    });
    container.innerHTML = html;
};

window.filterHistory = function(type, btnElement) {
    document.querySelectorAll('.hist-tab-btn').forEach(btn => btn.classList.remove('active')); btnElement.classList.add('active');
    document.querySelectorAll('.history-item').forEach(item => {
        if (type === 'all') item.classList.remove('hide'); else if (type === 'watch') item.classList.contains('type-watch') ? item.classList.remove('hide') : item.classList.add('hide'); else if (type === 'transaction') item.classList.contains('type-transaction') ? item.classList.remove('hide') : item.classList.add('hide');
    });
};

// ================= APP INSTALL & ADS =================
window.closeInstallBanner = function() { 
    const banner = document.getElementById('app-install-banner'); 
    if (banner) { 
        banner.style.animation = 'slideUpBanner 0.5s reverse forwards'; 
        setTimeout(() => { banner.style.display = 'none'; }, 500); 
        localStorage.setItem('cnp_hide_install_banner', 'true'); // Lưu lại để không làm phiền nếu người dùng đã chủ động tắt
    } 
};
window.openInstallModal = function() { document.getElementById('app-install-modal').classList.add('show'); };
window.closeInstallModal = function() { document.getElementById('app-install-modal').classList.remove('show'); };
window.switchInstallTab = function(os) { document.querySelectorAll('.os-tab').forEach(btn => btn.classList.remove('active')); document.querySelectorAll('.install-tab-content').forEach(content => content.classList.remove('active')); if (os === 'ios') { document.querySelectorAll('.os-tab')[0].classList.add('active'); document.getElementById('install-tab-ios').classList.add('active'); } else { document.querySelectorAll('.os-tab')[1].classList.add('active'); document.getElementById('install-tab-android').classList.add('active'); } };
document.getElementById('app-install-modal').addEventListener('click', function(e) { if (e.target === this) window.closeInstallModal(); });

window.closeTopRightEvent = function(event) { event.preventDefault(); event.stopPropagation(); const banner = document.getElementById('top-right-event-banner'); if(banner) { banner.style.animation = 'slideOutRight 0.5s forwards'; setTimeout(() => { banner.classList.remove('show-event'); banner.style.animation = ''; }, 500); } };
window.goToWalletAndClose = function(event) { event.preventDefault(); openTab('tab-wallet'); window.closeTopRightEvent(event); };
window.triggerEventBanner = function() { 
    const banner = document.getElementById('top-right-event-banner'); 
    if(banner) { banner.classList.remove('show-event'); void banner.offsetWidth; banner.classList.add('show-event'); } 
};

window.updateFileName = function(input) { const label = document.getElementById('support-image-label'); if (input.files && input.files.length > 0) { let fileName = input.files[0].name; if (fileName.length > 25) fileName = fileName.substring(0, 22) + '...'; label.innerHTML = `<i class="fas fa-image"></i> Đã chọn: ${fileName}`; label.classList.add('has-file'); } else { label.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Tải lên ảnh minh họa lỗi (Nếu có)`; label.classList.remove('has-file'); } };

window.submitSupportTicket = async function() { 
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    if(!currentUser) { showNotification('warning', 'Yêu cầu', 'Bạn cần đăng nhập để gửi phiếu hỗ trợ!', 'Đăng nhập'); return; }

    let name = document.getElementById('support-name').value; 
    let email = document.getElementById('support-email').value; 
    let content = document.getElementById('support-content').value; 
    let imgInput = document.getElementById('support-image');

    if(!name || !email || !content) { showNotification('warning', 'Thiếu Thông Tin', 'Vui lòng điền đầy đủ Họ tên, Email và Nội dung!', 'Đã hiểu'); return; } 

    let base64Image = null;
    if(imgInput.files && imgInput.files.length > 0) {
        base64Image = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(imgInput.files[0]);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    window.executeWithLoading(async () => {
        try {
            let res = await fetch('https://chunhatpham-online.onrender.com/api/support', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username, name, email, content, image: base64Image })
            });
            if(res.ok) {
                showNotification('success', 'Gửi Thành Công', 'Phiếu hỗ trợ đã được gửi. Chúng tôi sẽ phản hồi sớm nhất!', 'Đóng'); 
                document.getElementById('support-name').value = ''; document.getElementById('support-email').value = ''; document.getElementById('support-content').value = ''; imgInput.value = ''; window.updateFileName(imgInput); 
            } else {
                try {
                    let errData = await res.json();
                    showNotification('error', 'Gửi Thất Bại', errData.message || 'Lỗi không xác định từ máy chủ.', 'Đóng');
                } catch (e) {
                    showNotification('error', 'Gửi Thất Bại', 'Máy chủ trả về lỗi không mong muốn. Vui lòng thử lại sau.', 'Đóng');
                }
            }
        } catch (e) { showNotification('error', 'Lỗi Mạng', 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền.', 'Đóng'); }
    });
};

// ================= KHỞI CHẠY TẤT CẢ KHI LOAD WEB XONG =================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        let topToast = document.getElementById('top-welcome-toast');
        if(topToast) {
            topToast.classList.add('show');
            setTimeout(() => { topToast.classList.remove('show'); }, 4000);
        }
    }, 1000);

    checkAuthStatus();
    // Khởi chạy hệ thống đồng bộ phim từ Database
    window.fetchMoviesFromDatabase();
    setTimeout(() => { renderHistoryUI(); syncPremiumUI(); }, 500);
    setTimeout(window.triggerEventBanner, 800); 
    
    setTimeout(() => {
        let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
        if (currentUser) { 
            window.updateAndSaveBalance(currentUser.walletBalance || 0); 
            window.syncUserFromServer(); // Lấy dữ liệu tiền và VIP mới nhất từ Server
        }
    }, 200);

    // KIỂM TRA TRẠNG THÁI APP: Nếu đang mở từ Màn hình chính (Standalone) hoặc người dùng đã tắt bảng hướng dẫn
    setTimeout(() => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        const userClosedBanner = localStorage.getItem('cnp_hide_install_banner') === 'true';
        const installBanner = document.getElementById('app-install-banner');
        
        if (isStandalone || userClosedBanner) {
            if (installBanner) installBanner.style.display = 'none';
        }
    }, 50);
});

// ================= BỔ SUNG CHỨC NĂNG =================
window.toggleChangePasswordForm = function() {
    let form = document.getElementById('change-password-form');
    let icon = document.getElementById('cp-toggle-icon');
    if (form.style.display === 'none' || form.style.display === '') {
        form.style.display = 'block';
        if(icon) icon.style.transform = 'rotate(180deg)';
    } else {
        form.style.display = 'none';
        if(icon) icon.style.transform = 'rotate(0deg)';
    }
};

window.handleChangePassword = async function() {
    let currPass = document.getElementById('prof-curr-pass').value.trim();
    let newPass = document.getElementById('prof-new-pass').value.trim();
    let confPass = document.getElementById('prof-conf-pass').value.trim();

    if(!currPass || !newPass || !confPass) { showNotification('warning', 'Thiếu Thông Tin', 'Vui lòng điền đầy đủ mật khẩu!', 'Đã hiểu'); return; }
    if(newPass !== confPass) { showNotification('error', 'Lỗi Mật Khẩu', 'Mật khẩu xác nhận không khớp!', 'Sửa lại'); return; }
    if(newPass.length < 6) { showNotification('warning', 'Cảnh Báo', 'Mật khẩu mới phải có ít nhất 6 ký tự!', 'Đã hiểu'); return; }

    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));

    window.executeWithLoading(async () => {
        try {
            let res = await fetch('https://chunhatpham-online.onrender.com/api/user/change-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser.username, currentPassword: currPass, newPassword: newPass })
            });
            let data = await res.json();
            if(res.ok) {
                showNotification('success', 'Thành Công', data.message, 'Đóng');
                document.getElementById('prof-curr-pass').value = ''; document.getElementById('prof-new-pass').value = ''; document.getElementById('prof-conf-pass').value = '';
                toggleChangePasswordForm();
            } else { showNotification('error', 'Lỗi', data.message, 'Thử lại'); }
        } catch(e) { showNotification('error', 'Lỗi Mạng', 'Không kết nối được với Server', 'Đóng'); }
    });
};

window.switchAdminTab = function(tabId) {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-sub-tab').forEach(tab => tab.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById('admin-tab-' + tabId).classList.add('active');
};

window.adminFullData = { users: [], transactions: [], tickets: [] };

window.loadAdminData = async function() {
    // Tải và render User trước tiên, vì đây là tab mặc định và quan trọng nhất
    try {
        const usersRes = await fetch('https://chunhatpham-online.onrender.com/api/admin/users');
        if (!usersRes.ok) { let errText = await usersRes.text(); throw new Error(`Mã lỗi ${usersRes.status} - ${errText}`); }
        let rawUsers = await usersRes.json();
        if (!Array.isArray(rawUsers)) rawUsers = [];
        window.adminFullData.users = rawUsers;
        window.adminLoadedUsers = window.adminFullData.users; // Tương thích với code cũ
        window.renderAdminUsers(window.adminFullData.users);
    } catch (e) {
        console.error("Lỗi tải danh sách người dùng:", e);
        document.getElementById('admin-user-tbody').innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: #ff4e00;"><strong>LỖI TẢI DỮ LIỆU:</strong> ${e.message}<br><br><span style="color:#aaa; font-size:14px;">(Nguyên nhân: Máy chủ Render chưa cập nhật code. Vui lòng vào Render.com -> Manual Deploy -> Clear build cache & deploy)</span></td></tr>`;
    }

    // Tải các dữ liệu còn lại một cách độc lập để không làm ảnh hưởng đến nhau
    // Tải Giao dịch
    try {
        const txsRes = await fetch('https://chunhatpham-online.onrender.com/api/admin/transactions');
        if (!txsRes.ok) { let errText = await txsRes.text(); throw new Error(`Mã lỗi ${txsRes.status} - ${errText}`); }
        let rawTxs = await txsRes.json();
        if (!Array.isArray(rawTxs)) rawTxs = [];
        rawTxs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        window.adminFullData.transactions = rawTxs;
        
        const deposits = window.adminFullData.transactions.filter(t => t.amount > 0);
        const spends = window.adminFullData.transactions.filter(t => t.amount < 0);

        let depHtml = deposits.map(t => {
            let d = new Date(t.createdAt).toLocaleString('vi-VN');
            return `<tr><td>${d}</td><td style="color:#888; font-family: monospace;">${t.referenceCode}</td><td style="color:#00e676; font-weight:bold; font-size:16px;">+ ${t.amount.toLocaleString('vi-VN')}đ</td><td style="color:#f5c518;">${t.content}</td></tr>`;
        }).join('');
        document.getElementById('admin-tx-deposit-tbody').innerHTML = depHtml || '<tr><td colspan="4" style="text-align:center; padding: 30px; color:#888;">Chưa có giao dịch nạp tiền.</td></tr>';

        let spendHtml = spends.map(t => {
            let d = new Date(t.createdAt).toLocaleString('vi-VN');
            let absAmount = Math.abs(t.amount);
            return `<tr><td>${d}</td><td style="color:#888; font-family: monospace;">${t.referenceCode}</td><td style="color:#ff4e00; font-weight:bold; font-size:16px;">- ${absAmount.toLocaleString('vi-VN')}đ</td><td style="color:#f5c518;">${t.content}</td></tr>`;
        }).join('');
        document.getElementById('admin-tx-spend-tbody').innerHTML = spendHtml || '<tr><td colspan="4" style="text-align:center; padding: 30px; color:#888;">Chưa có giao dịch tiêu tiền.</td></tr>';
    } catch (e) {
        console.error("Lỗi tải giao dịch:", e);
        document.getElementById('admin-tx-deposit-tbody').innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 30px; color: #ff4e00;"><strong>LỖI TẢI DỮ LIỆU:</strong> ${e.message}<br><br><span style="color:#aaa; font-size:14px;">(Nguyên nhân: Máy chủ Render chưa cập nhật code. Vui lòng vào Render.com -> Manual Deploy -> Clear build cache & deploy)</span></td></tr>`;
        document.getElementById('admin-tx-spend-tbody').innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 30px; color: #ff4e00;"><strong>LỖI TẢI DỮ LIỆU:</strong> ${e.message}</td></tr>`;
    }

    // Tải Phiếu hỗ trợ
    try {
        const tksRes = await fetch('https://chunhatpham-online.onrender.com/api/admin/tickets');
        if (!tksRes.ok) { let errText = await tksRes.text(); throw new Error(`Mã lỗi ${tksRes.status} - ${errText}`); }
        let rawTickets = await tksRes.json();
        if (!Array.isArray(rawTickets)) rawTickets = [];
        // Sắp xếp ở đây để đảm bảo an toàn, ngay cả khi có dữ liệu cũ bị lỗi ngày tháng
        rawTickets.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        window.adminFullData.tickets = rawTickets;
        
        window.adminLoadedTickets = window.adminFullData.tickets; // Tương thích code cũ
        // Lọc thông minh hơn để tránh lỗi dữ liệu cũ
        const pendingTickets = window.adminFullData.tickets.filter(t => t.status === 'pending' || !t.status);
        const repliedTickets = window.adminFullData.tickets.filter(t => t.status && t.status !== 'pending');
        
        document.getElementById('pending-tickets-badge').innerText = pendingTickets.length;

        let pendingHtml = pendingTickets.map(tk => `<tr><td><strong style="color:white;">${tk.username}</strong><br><span style="font-size:11px;color:#aaa;">${tk.email}</span></td><td>${new Date(tk.createdAt || Date.now()).toLocaleString('vi-VN')}</td><td><span style="color:#ff4e00; font-weight:bold;">Chờ xử lý</span></td><td><button class="btn-admin-action" style="background:#00c6ff; color:white;" onclick="openAdminReplyModal('${tk._id}')"><i class="fas fa-reply"></i> Đọc & Trả Lời</button></td></tr>`).join('');
        document.getElementById('admin-ticket-pending-tbody').innerHTML = pendingHtml || '<tr><td colspan="4" style="padding: 30px; text-align: center; color: #888;">Không có phiếu chờ xử lý.</td></tr>';

        let repliedHtml = repliedTickets.map(tk => `<tr><td><strong style="color:white;">${tk.username}</strong><br><span style="font-size:11px;color:#aaa;">${tk.email}</span></td><td>${new Date(tk.createdAt || Date.now()).toLocaleString('vi-VN')}</td><td><span style="color:#00e676;">Đã trả lời</span></td><td><button class="btn-admin-action" style="background:#444; color:white;" onclick="openAdminReplyModal('${tk._id}')"><i class="fas fa-eye"></i> Xem Lại</button></td></tr>`).join('');
        document.getElementById('admin-ticket-replied-tbody').innerHTML = repliedHtml || '<tr><td colspan="4" style="padding: 30px; text-align: center; color: #888;">Chưa có phiếu nào được xử lý.</td></tr>';
    } catch (e) {
        console.error("Lỗi tải phiếu hỗ trợ:", e);
        document.getElementById('admin-ticket-pending-tbody').innerHTML = `<tr><td colspan="4" style="padding: 30px; text-align: center; color: #ff4e00; font-size: 15px;"><strong>LỖI TẢI DỮ LIỆU:</strong><br>${e.message}<br><br><span style="color:#aaa; font-size: 13px;">(Máy chủ Render chưa nhận được Code mới. Vui lòng vào Render.com -> Manual Deploy -> Clear build cache & deploy)</span></td></tr>`;
        document.getElementById('admin-ticket-replied-tbody').innerHTML = `<tr><td colspan="4" style="padding: 30px; text-align: center; color: #ff4e00;">Lỗi tải dữ liệu: ${e.message}</td></tr>`;
    }

    // Sau khi tải xong tất cả, tính toán thống kê mặc định (Hôm nay)
    filterAdminStats('today', document.querySelector('.time-filter-btn'));
    
    renderAdminTiers();
    renderAdminDeposits();
};

window.filterAdminStats = function(period, btn) {
    document.querySelectorAll('.time-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate;

    if (period === 'today') startDate = today;
    else if (period === 'yesterday') startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    else if (period === '7days') startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    else if (period === '30days') startDate = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
    else if (period === '60days') startDate = new Date(today.getTime() - 59 * 24 * 60 * 60 * 1000);
    else if (period === '1year') startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

    const endDate = (period === 'yesterday') ? today : new Date(now.getTime() + 1000); // +1s để bao gồm cả ngày hôm nay

    const filteredUsers = window.adminFullData.users.filter(u => new Date(u.createdAt) >= startDate && new Date(u.createdAt) < endDate);
    const filteredTxs = window.adminFullData.transactions.filter(t => new Date(t.createdAt) >= startDate && new Date(t.createdAt) < endDate);
    const filteredTickets = window.adminFullData.tickets.filter(t => new Date(t.createdAt) >= startDate && new Date(t.createdAt) < endDate);

    document.getElementById('stat-total-users').innerText = filteredUsers.length.toLocaleString('vi-VN');
    const totalRevenue = filteredTxs.filter(t => t.status === 'success' && t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    document.getElementById('stat-total-revenue').innerText = totalRevenue.toLocaleString('vi-VN') + 'đ';
    const pendingTickets = filteredTickets.filter(t => t.status === 'pending' || !t.status).length;
    document.getElementById('stat-pending-tickets').innerText = pendingTickets;
};

// Hàm Render và Lọc Danh Sách Người Dùng
window.renderAdminUsers = function(usersArray) {
    let uHtml = '';
    if(usersArray.length > 0) {
        usersArray.forEach(u => {
            let vipStatus = u.isPremium ? `<span style="color:#f5c518"><i class="fas fa-crown"></i> ${u.premiumTier}</span>` : 'Không';
            let createdDate = new Date(u.createdAt).toLocaleDateString('vi-VN');
            uHtml += `<tr><td style="font-weight:bold; color: white; font-size: 16px;">${u.username}<br><span style="font-size:11px; color:#888; font-weight:normal;">Tạo: ${createdDate}</span></td><td><i class="fas fa-phone" style="font-size:11px; color:#aaa;"></i> ${u.phone}<br><i class="fas fa-envelope" style="font-size:11px; color:#aaa;"></i> <span style="font-size:13px; color:#ccc;">${u.email}</span></td><td style="color:#00e676; font-weight:bold; font-size: 16px;">${u.walletBalance.toLocaleString('vi-VN')}đ</td><td>${vipStatus}</td><td style="display: flex; gap: 8px;">
                <button class="btn-admin-action" onclick="openManualAddModal('${u.username}')" title="Cộng tiền"><i class="fas fa-plus"></i></button>
                <button class="btn-admin-action" style="background: #00c6ff;" onclick="openEditUserModal('${u.username}', ${u.walletBalance}, ${u.isPremium}, '${u.premiumTier}')" title="Sửa"><i class="fas fa-pen"></i></button>
                <button class="btn-admin-action" style="background: #e50914; color: white;" onclick="deleteUser('${u.username}')" title="Xóa"><i class="fas fa-trash"></i></button>
            </td></tr>`;
        });
    }
    let uBody = document.getElementById('admin-user-tbody'); if(uBody) uBody.innerHTML = uHtml || '<tr><td colspan="5" style="padding: 30px; text-align: center; color: #888;">Không tìm thấy người dùng phù hợp.</td></tr>';
};

window.filterAdminUsers = function() {
    let keyword = document.getElementById('admin-search-input').value.toLowerCase().trim();
    let tierFilter = document.getElementById('admin-filter-tier').value;
    
    let sorted = [...window.adminLoadedUsers].sort((a, b) => {
        if (keyword === '') return 0; // Không tìm kiếm thì giữ nguyên thứ tự
        const aMatch = a.username.toLowerCase().includes(keyword) || a.phone.includes(keyword) || a.email.toLowerCase().includes(keyword);
        const bMatch = b.username.toLowerCase().includes(keyword) || b.phone.includes(keyword) || b.email.toLowerCase().includes(keyword);
        if (aMatch && !bMatch) return -1; // a lên đầu
        if (!aMatch && bMatch) return 1;  // b lên đầu
        return 0; // Giữ nguyên vị trí tương đối
    });

    let finalFiltered = sorted.filter(u => {
        let matchesTier = (tierFilter === 'all') || (tierFilter === 'vip' && u.isPremium) || (tierFilter === 'normal' && !u.isPremium);
        return matchesTier;
    });

    // Nếu không có từ khóa tìm kiếm, chỉ lọc theo tier
    if (keyword === '') finalFiltered = window.adminLoadedUsers.filter(u => (tierFilter === 'all') || (tierFilter === 'vip' && u.isPremium) || (tierFilter === 'normal' && !u.isPremium));

    window.renderAdminUsers(finalFiltered);
};

window.openManualAddModal = function(username) {
    document.getElementById('admin-target-user').value = username;
    document.getElementById('admin-add-amount').value = '';
    document.getElementById('admin-add-balance-modal').classList.add('show');
};
window.submitManualBalance = async function() {
    let un = document.getElementById('admin-target-user').value; 
    let rawAmt = document.getElementById('admin-add-amount').value;
    
    // Tự động nhận diện chữ 'k', dấu chấm, phẩy để chuyển thành số chuẩn
    let amt = parseInt(rawAmt.toLowerCase().replace(/k/g, '000').replace(/[,.]/g, '').trim());
    if(!amt || amt <= 0 || isNaN(amt)) { showNotification('warning', 'Lỗi', 'Vui lòng nhập số tiền hợp lệ (VD: 100000, 100k, 100.000)', 'OK'); return; }
    window.executeWithLoading(async () => {
        try {
            let res = await fetch('https://chunhatpham-online.onrender.com/api/admin/add-balance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUsername: un, amount: amt }) });
            let data = await res.json();
            if(res.ok) { showNotification('success', 'Thành Công', data.message, 'Đóng'); document.getElementById('admin-add-balance-modal').classList.remove('show'); loadAdminData(); }
            else { showNotification('error', 'Lỗi', data.message, 'Đóng'); }
        } catch(e) { showNotification('error', 'Lỗi Mạng', 'Không gọi được API', 'Đóng'); }
    });
};

window.openEditUserModal = function(username, balance, isPremium, tier) {
    document.getElementById('admin-edit-username').value = username;
    document.getElementById('admin-edit-balance').value = balance;
    document.getElementById('admin-edit-ispremium').value = isPremium.toString();
    document.getElementById('admin-edit-tier').value = tier;
    document.getElementById('admin-edit-password').value = ''; // Luôn để trống
    document.getElementById('admin-edit-user-modal').classList.add('show');
};

window.submitEditUser = async function() {
    let un = document.getElementById('admin-edit-username').value;
    let rawBal = document.getElementById('admin-edit-balance').value;
    let parsedBal = parseInt(rawBal.toLowerCase().replace(/k/g, '000').replace(/[,.]/g, '').trim());

    let payload = {
        newBalance: isNaN(parsedBal) ? 0 : parsedBal,
        isPremium: document.getElementById('admin-edit-ispremium').value,
        premiumTier: document.getElementById('admin-edit-tier').value,
        newPassword: document.getElementById('admin-edit-password').value
    };

    window.executeWithLoading(async () => {
        try {
            let res = await fetch(`https://chunhatpham-online.onrender.com/api/admin/user/${un}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            let data = await res.json();
            if(res.ok) { showNotification('success', 'Thành Công', data.message, 'Đóng'); document.getElementById('admin-edit-user-modal').classList.remove('show'); loadAdminData(); }
            else { showNotification('error', 'Lỗi', data.message, 'Đóng'); }
        } catch(e) { showNotification('error', 'Lỗi Mạng', 'Không kết nối được API', 'Đóng'); }
    });
};

window.deleteUser = async function(username) {
    if(username === 'chunhatpham_admin') { showNotification('error', 'Từ Chối', 'Không thể xóa tài khoản Admin tối cao!', 'Đã hiểu'); return; }
    if(!confirm(`BẠN CÓ CHẮC CHẮN MUỐN XÓA VĨNH VIỄN TÀI KHOẢN "${username}" KHÔNG? Hành động này không thể hoàn tác!`)) return;
    try {
        let res = await fetch(`https://chunhatpham-online.onrender.com/api/admin/user/${username}`, { method: 'DELETE' });
        let data = await res.json();
        if(res.ok) { showNotification('success', 'Đã Xóa', data.message, 'OK'); loadAdminData(); }
    } catch(e) { showNotification('error', 'Lỗi', 'Lỗi kết nối máy chủ', 'Đóng'); }
};

// ================= CÁC TÍNH NĂNG MỚI CỦA QUẢN TRỊ CẤP CAO =================
window.renderAdminTiers = function() {
    let tHtml = '';
    // Lọc ra các tài khoản đang có VIP hoặc Tắt Quảng Cáo
    let activeUsers = window.adminFullData.users.filter(u => u.isPremium || (u.noAdsExpiry && new Date(u.noAdsExpiry) > new Date()));
    
    if(activeUsers.length > 0) {
        activeUsers.forEach(u => {
            let isVip = u.isPremium;
            let tierLabel = isVip ? `<span style="color:#f5c518; font-weight:bold;"><i class="fas fa-crown"></i> Premium ${u.premiumTier.toUpperCase()}</span>` : `<span style="color:#00e676;"><i class="fas fa-ad"></i> Tắt Quảng Cáo</span>`;
            let expiryDate = isVip ? new Date(u.premiumExpiry) : new Date(u.noAdsExpiry);
            let diffTime = expiryDate.getTime() - new Date().getTime();
            let daysLeft = Math.ceil(diffTime / (1000 * 3600 * 24));
            let daysLeftHtml = daysLeft > 1000 ? '∞ (Vĩnh viễn)' : `<strong style="color: #00c6ff;">Còn ${daysLeft} ngày</strong>`;
            
            tHtml += `<tr>
                <td style="color: white; font-weight: bold;">${u.username}</td>
                <td>${tierLabel}</td>
                <td>${daysLeftHtml}</td>
                <td style="color:#aaa; font-size: 12px;">${expiryDate.toLocaleString('vi-VN')}</td>
                <td><button class="btn-admin-action" style="background: linear-gradient(45deg, #f5c518, #ff9800); color: black;" onclick="openAddPremiumDaysModal('${u.username}')"><i class="fas fa-plus-circle"></i> Tặng/Cộng Ngày</button></td>
            </tr>`;
        });
    }
    let tBody = document.getElementById('admin-tier-tbody'); if(tBody) tBody.innerHTML = tHtml || '<tr><td colspan="5" style="padding: 30px; text-align: center; color: #888;">Chưa có tài khoản nào kích hoạt dịch vụ.</td></tr>';
};

window.renderAdminDeposits = function() {
    let dHtml = '';
    let depositData = [];
    
    // Tính tổng tiền nạp của mỗi User
    window.adminFullData.users.forEach(u => {
        // Tìm tất cả các giao dịch Nạp (+) liên quan đến SĐT của User này
        let userTxs = window.adminFullData.transactions.filter(t => t.amount > 0 && t.contact === u.phone);
        let totalDep = userTxs.reduce((sum, t) => sum + t.amount, 0);
        
        if(totalDep > 0) {
            depositData.push({ username: u.username, phone: u.phone, email: u.email, totalDeposit: totalDep, balance: u.walletBalance });
        }
    });
    
    // Sắp xếp theo tổng tiền nạp giảm dần (Đại gia lên đầu)
    depositData.sort((a, b) => b.totalDeposit - a.totalDeposit);
    
    if(depositData.length > 0) {
        depositData.forEach((d, idx) => {
            let rankLabel = idx === 0 ? '🥇 TOP 1' : (idx === 1 ? '🥈 TOP 2' : (idx === 2 ? '🥉 TOP 3' : `#${idx + 1}`));
            let rankColor = idx === 0 ? '#ffd700' : (idx === 1 ? '#c0c0c0' : (idx === 2 ? '#cd7f32' : '#888'));
            dHtml += `<tr>
                <td style="color:${rankColor}; font-weight:bold; font-size:16px;">${rankLabel}</td>
                <td style="color: white; font-weight: bold;">${d.username}</td>
                <td style="color:#aaa; font-size:12px;">${d.phone}<br>${d.email}</td>
                <td style="color:#00e676; font-weight:bold; font-size: 18px;">${d.totalDeposit.toLocaleString('vi-VN')} đ</td>
                <td style="color:#ccc;">${d.balance.toLocaleString('vi-VN')} đ</td>
            </tr>`;
        });
    }
    let dBody = document.getElementById('admin-deposit-tbody'); if(dBody) dBody.innerHTML = dHtml || '<tr><td colspan="5" style="padding: 30px; text-align: center; color: #888;">Hệ thống chưa ghi nhận dòng tiền nạp nào.</td></tr>';
};

window.openAddPremiumDaysModal = function(username) {
    document.getElementById('admin-prem-target').value = username;
    document.getElementById('admin-prem-days').value = '';
    document.getElementById('admin-add-premium-modal').classList.add('show');
};

window.submitAddPremiumDays = async function() {
    let payload = { targetUsername: document.getElementById('admin-prem-target').value, packageType: document.getElementById('admin-prem-type').value, tier: document.getElementById('admin-prem-tier').value, addDays: document.getElementById('admin-prem-days').value };
    if(!payload.addDays || payload.addDays <= 0) { showNotification('warning', 'Lỗi', 'Vui lòng nhập số ngày cần tặng hợp lệ!', 'Đã hiểu'); return; }
    
    window.executeWithLoading(async () => {
        try {
            let res = await fetch('https://chunhatpham-online.onrender.com/api/admin/add-premium-days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            let data = await res.json();
            if(res.ok) { showNotification('success', 'Thành Công', data.message, 'Đóng'); document.getElementById('admin-add-premium-modal').classList.remove('show'); loadAdminData(); }
            else { showNotification('error', 'Lỗi', data.message, 'Đóng'); }
        } catch(e) { showNotification('error', 'Lỗi Mạng', 'Không gọi được API', 'Đóng'); }
    });
};

window.switchTicketTab = function(tabName, btn) {
    document.querySelectorAll('.ticket-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.ticket-content-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('ticket-content-' + tabName).classList.add('active');
};

window.switchTxTab = function(tabName, btn) {
    let parentTab = document.getElementById('admin-tab-transactions');
    parentTab.querySelectorAll('.ticket-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    parentTab.querySelectorAll('.ticket-content-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('tx-content-' + tabName).classList.add('active');
};

// ================= TÍNH NĂNG THÔNG BÁO VÀ TRẢ LỜI SUPPORT =================
window.toggleNotifPanel = function() {
    let panel = document.getElementById('notif-panel');
    panel.classList.toggle('show');
};

window.loadNotifications = async function() {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    if(!currentUser) return;
    try {
        let res = await fetch(`https://chunhatpham-online.onrender.com/api/user/notifications/${currentUser.username}`);
        let notifs = await res.json();
        
        let badge = document.getElementById('notif-badge');
        let list = document.getElementById('notif-list');
        let unreadCount = notifs.filter(n => !n.isRead).length;

        if(unreadCount > 0) { badge.style.display = 'flex'; badge.innerText = unreadCount; } else { badge.style.display = 'none'; }
        
        if(notifs.length > 0) {
            let html = '';
            notifs.forEach(n => {
                let cClass = n.isRead ? '' : 'unread';
                let d = new Date(n.createdAt).toLocaleDateString('vi-VN', {hour:'2-digit', minute:'2-digit'});
                html += `<div class="notif-item ${cClass}" onclick="markNotifRead('${n._id}', this)">
                    <div class="notif-title">${n.title}</div><div class="notif-msg">${n.message}</div><div class="notif-time">${d}</div>
                </div>`;
            });
            list.innerHTML = html;
        } else { list.innerHTML = '<p style="padding:15px; color:#888; font-size:13px; text-align:center;">Trống</p>'; }
    } catch(e) { console.log(e); }
};

window.markNotifRead = async function(id, el) {
    if(!el.classList.contains('unread')) return;
    el.classList.remove('unread');
    let badge = document.getElementById('notif-badge');
    let currentNum = parseInt(badge.innerText);
    if(currentNum > 1) { badge.innerText = currentNum - 1; } else { badge.style.display = 'none'; }
    fetch(`https://chunhatpham-online.onrender.com/api/user/notifications/read/${id}`, { method: 'POST' }).catch(e=>{});
};

window.openAdminReplyModal = function(ticketId) {
    window.executeWithLoading(async () => {
        try {
            let res = await fetch(`https://chunhatpham-online.onrender.com/api/admin/ticket/${ticketId}`);
            if(res.ok) {
                let tk = await res.json();
                document.getElementById('admin-reply-ticket-id').value = ticketId;
                document.getElementById('admin-ticket-content-view').innerHTML = `<strong>Nội dung:</strong><br/>${tk.content}`;
                let imgView = document.getElementById('admin-ticket-image-view');
                if(tk.image) { imgView.style.display = 'block'; imgView.querySelector('img').src = tk.image; } else { imgView.style.display = 'none'; }
                document.getElementById('admin-reply-text').value = tk.replyContent || '';
                document.getElementById('admin-reply-modal').classList.add('show');
            } else {
                showNotification('error', 'Lỗi', 'Không thể tải chi tiết phiếu này', 'Đóng');
            }
        } catch(e) {
            showNotification('error', 'Lỗi Mạng', 'Không kết nối được với máy chủ', 'Đóng');
        }
    }, 100);
};

window.submitAdminReply = async function() {
    let tid = document.getElementById('admin-reply-ticket-id').value;
    let replyText = document.getElementById('admin-reply-text').value.trim();
    if(!replyText) { showNotification('warning', 'Lỗi', 'Vui lòng nhập nội dung trả lời!', 'Đã hiểu'); return; }
    window.executeWithLoading(async () => {
        try {
            let res = await fetch('https://chunhatpham-online.onrender.com/api/admin/ticket/reply', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ticketId: tid, replyContent: replyText }) });
            if(res.ok) { showNotification('success', 'Thành Công', 'Đã phản hồi tới khách hàng!', 'Đóng'); document.getElementById('admin-reply-modal').classList.remove('show'); loadAdminData(); }
        } catch(e) { showNotification('error', 'Lỗi', 'Lỗi máy chủ', 'Đóng'); }
    });
};

// ================= LOGIC QUÊN MẬT KHẨU =================
window.openForgotModal = function() {
    document.getElementById('fw-step-1').classList.add('active');
    document.getElementById('fw-step-2').classList.remove('active');
    document.getElementById('fw-identifier').value = '';
    document.getElementById('forgot-modal').classList.add('show');
};

window.closeForgotModal = function() {
    document.getElementById('forgot-modal').classList.remove('show');
};

window.requestResetOtp = async function() {
    let identifier = document.getElementById('fw-identifier').value.trim();
    if(!identifier) { showNotification('warning', 'Thiếu Thông Tin', 'Vui lòng nhập Email hoặc Username!', 'Đã hiểu'); return; }
    
    window.executeWithLoading(async () => {
        try {
            let res = await fetch('https://chunhatpham-online.onrender.com/api/auth/forgot-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier })
            });
            let data = await res.json();
            if(res.ok) {
                document.getElementById('fw-step-1').classList.remove('active');
                document.getElementById('fw-step-2').classList.add('active');
                document.getElementById('fw-target-contact').innerText = data.maskedEmail;
                document.getElementById('fw-hidden-email').value = data.email;
                showNotification('success', 'Thành Công', 'Đã gửi mã OTP vào email của bạn!', 'Đóng');
            } else {
                showNotification('error', 'Lỗi', data.message, 'Đóng');
            }
        } catch(e) {
            showNotification('error', 'Lỗi Mạng', 'Không thể kết nối đến máy chủ.', 'Đóng');
        }
    });
};

window.submitNewPassword = async function() {
    let email = document.getElementById('fw-hidden-email').value;
    let otp = document.getElementById('fw-otp').value.trim();
    let newPass = document.getElementById('fw-new-pass').value.trim();
    
    if(!otp || !newPass) { showNotification('warning', 'Thiếu Thông Tin', 'Vui lòng nhập OTP và Mật khẩu mới!', 'Đã hiểu'); return; }
    if(newPass.length < 6) { showNotification('warning', 'Lỗi', 'Mật khẩu phải từ 6 ký tự trở lên!', 'Đã hiểu'); return; }

    window.executeWithLoading(async () => {
        try {
            let res = await fetch('https://chunhatpham-online.onrender.com/api/auth/reset-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, newPassword: newPass })
            });
            let data = await res.json();
            if(res.ok) {
                showNotification('success', 'Đổi Mật Khẩu Thành Công', 'Mật khẩu của bạn đã được cập nhật.', 'Đăng Nhập Ngay');
                closeForgotModal();
                document.getElementById('fw-otp').value = '';
                document.getElementById('fw-new-pass').value = '';
                switchAuthTab('login');
            } else {
                showNotification('error', 'Lỗi', data.message, 'Thử lại');
            }
        } catch(e) {
            showNotification('error', 'Lỗi Mạng', 'Không thể kết nối đến máy chủ.', 'Đóng');
        }
    });
};

// ================= HỆ THỐNG GROUP CHAT =================
window.chatUpdateInterval = null;
window.currentPinnedMsgId = null;
window.contextMsgId = null;
window.contextMsgOwner = null;
window.selectedImageBase64 = null;
window.selectedReplyMsg = null;

window.initChatUI = function() {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    let attachBtn = document.getElementById('chat-btn-attach');
    let counter = document.getElementById('chat-char-counter');
    let input = document.getElementById('chat-input-box');
    if (currentUser && currentUser.role === 'admin') { 
        if(attachBtn) attachBtn.style.display = 'flex'; 
        if(counter) counter.style.display = 'none'; 
        if(input) input.removeAttribute('maxlength'); 
    } else { 
        if(attachBtn) attachBtn.style.display = 'none'; 
        if(counter) counter.style.display = 'block'; 
        if(input) input.setAttribute('maxlength', '100'); 
    }
};

window.updateChatCounter = function() {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user')); if(currentUser && currentUser.role === 'admin') return;
    let input = document.getElementById('chat-input-box');
    let counter = document.getElementById('chat-char-counter');
    if(input && counter) {
        let len = input.value.length;
        counter.innerText = `${len}/100`;
        if (len >= 100) counter.style.color = '#e50914';
        else counter.style.color = '#888';
    }
};

window.handleChatImageSelect = function(input) {
    if (input.files && input.files[0]) {
        let reader = new FileReader();
        reader.onload = function(e) { window.selectedImageBase64 = e.target.result; document.getElementById('cip-img').src = window.selectedImageBase64; document.getElementById('chat-image-preview').style.display = 'flex'; document.getElementById('chat-input-box').focus(); };
        reader.readAsDataURL(input.files[0]);
    }
};
window.cancelImageUpload = function() { window.selectedImageBase64 = null; document.getElementById('chat-img-input').value = ''; document.getElementById('chat-image-preview').style.display = 'none'; };

window.prepareReplyWrapper = function() { window.prepareReply(window.contextMsgId, window.contextMsgOwner); };
window.prepareReply = function(msgId, owner) {
    if(!msgId) return; let msgEl = document.querySelector(`.msg-row[data-id="${msgId}"]`); if(!msgEl) return;
    let bubble = msgEl.querySelector('.msg-bubble');
    let content = bubble ? bubble.innerText : "Hình ảnh / Tin nhắn";
    if(content.includes('thu hồi')) return; 
    
    window.selectedReplyMsg = { msgId: msgId, username: owner, content: content.substring(0, 30) + (content.length > 30 ? '...' : '') };
    document.getElementById('rp-user').innerText = `Đang trả lời: ${window.selectedReplyMsg.username}`; document.getElementById('rp-text').innerText = window.selectedReplyMsg.content; document.getElementById('chat-reply-preview').style.display = 'flex'; document.getElementById('chat-context-menu').classList.remove('show'); document.getElementById('chat-context-menu').style.display = 'none'; document.getElementById('chat-input-box').focus();
};
window.cancelReply = function() { window.selectedReplyMsg = null; document.getElementById('chat-reply-preview').style.display = 'none'; };

window.loadChatMessages = async function() {
    try {
        let res = await fetch('https://chunhatpham-online.onrender.com/api/chat');
        let messages = await res.json();
        
        let chatArea = document.getElementById('chat-messages-area');
        if(!chatArea) return;
        
        let currentUser = JSON.parse(localStorage.getItem('cnp_current_user')) || {};
        let html = '';
        let pinnedMsg = null;

        messages.forEach(m => {
            if (m.isPinned) pinnedMsg = m;

            let isMine = m.username === currentUser.username;
            let rowClass = isMine ? 'mine' : 'other';
            
            let badge = '';
            if (m.role === 'admin') badge = '<span class="admin-badge"><i class="fas fa-shield-alt"></i> Admin</span>';
            else if (m.isPremium) badge = `<span class="vip-badge"><i class="fas fa-crown"></i> ${m.premiumTier}</span>`;
            
            let timeStr = new Date(m.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
            let senderHtml = isMine ? `<div class="msg-sender">${m.username} ${badge}</div>` : `<div class="msg-sender">${badge} ${m.username}</div>`;

            let bubbleContent = '';
            if(m.isDeleted) {
                bubbleContent = `<div class="msg-bubble is-deleted"><i class="fas fa-ban"></i> Tin nhắn đã bị thu hồi</div>`;
            } else {
                let quoteHtml = m.replyTo ? `<div class="msg-quote" onclick="scrollToMessage('${m.replyTo.msgId}')"><strong><i class="fas fa-reply"></i> ${m.replyTo.username}</strong>${m.replyTo.content}</div>` : '';
                let imgHtml = m.image ? `<img src="${m.image}" class="msg-image-content" onclick="window.open('${m.image}')">` : '';
                let textHtml = m.content ? `<div>${m.content}</div>` : '';
                bubbleContent = `<div class="msg-bubble">${quoteHtml}${textHtml}${imgHtml}</div>`;
            }

            let reactHtml = '';
            if(m.reactions && m.reactions.length > 0 && !m.isDeleted) {
                let rMap = {}; m.reactions.forEach(r => { rMap[r.emoji] = (rMap[r.emoji] || 0) + 1; });
                reactHtml = `<div class="msg-reactions-bar">`;
                for(let emoji in rMap) { reactHtml += `<div class="reaction-badge" onclick="sendReaction('${m._id}', '${emoji}')">${emoji} ${rMap[emoji]}</div>`; }
                reactHtml += `<div class="add-reaction-btn" onclick="showReactionMenu(event, '${m._id}')"><i class="fas fa-plus"></i></div></div>`;
            } else if (!m.isDeleted) {
                reactHtml = `<div class="msg-reactions-bar"><div class="add-reaction-btn" onclick="showReactionMenu(event, '${m._id}')"><i class="fas fa-plus"></i></div></div>`;
            }

            let optionsHtml = '';
            if (!m.isDeleted) {
                optionsHtml = `
                <div class="msg-options-wrapper">
                    <button class="msg-opt-btn" onclick="showChatContext(event, '${m._id}', '${m.username}')" title="Thêm"><i class="fas fa-ellipsis-v"></i></button>
                    <button class="msg-opt-btn" onclick="prepareReply('${m._id}', '${m.username}')" title="Trả lời"><i class="fas fa-reply"></i></button>
                </div>`;
            }

            html += `
                <div class="msg-row ${rowClass}" id="msg-${m._id}" data-id="${m._id}" data-owner="${m.username}" oncontextmenu="showChatContext(event, '${m._id}', '${m.username}')">
                    ${senderHtml}
                    <div style="display:flex; align-items:center; position:relative; width:100%; justify-content:${isMine ? 'flex-end' : 'flex-start'};">
                        ${isMine ? optionsHtml : ''}
                        ${bubbleContent}
                        ${!isMine ? optionsHtml : ''}
                    </div>
                    ${reactHtml}
                    <div class="msg-time">${timeStr}</div>
                </div>
            `;
        });

        let pinnedBar = document.getElementById('chat-pinned-bar');
        if (pinnedBar) {
            if (pinnedMsg) {
                pinnedBar.style.display = 'flex'; 
                document.getElementById('cp-text').innerText = pinnedMsg.content || "[Hình ảnh/Tệp]"; 
                window.currentPinnedMsgId = pinnedMsg._id;
                if(currentUser.role === 'admin') document.getElementById('cp-close-btn').style.display = 'block'; else document.getElementById('cp-close-btn').style.display = 'none';
            } else { pinnedBar.style.display = 'none'; }
        }

        let isAtBottom = chatArea.scrollHeight - chatArea.scrollTop <= chatArea.clientHeight + 250;
        chatArea.innerHTML = html || '<div style="text-align:center; color:#888; font-style:italic; margin-top:20px;">Cộng đồng chưa có tin nhắn nào. Hãy là người đầu tiên!</div>';
        if (isAtBottom) chatArea.scrollTop = chatArea.scrollHeight;
        
        initChatUI();

    } catch (e) { console.error("Lỗi tải tin nhắn:", e); }
};

window.sendChatMessage = async function() {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    if(!currentUser) {
        showNotification('warning', 'Yêu Cầu', 'Bạn cần đăng nhập để chat!', 'Đăng Nhập');
        return;
    }

    let inputEl = document.getElementById('chat-input-box');
    let content = inputEl.value.trim();
    
    if(currentUser.role !== 'admin') {
        if(!content) return;
        if(content.length > 100) { showNotification('error', 'Cảnh Báo', 'Quá 100 ký tự!', 'Sửa Lại'); return; }
        if((content.match(/\p{Emoji_Presentation}/gu) || []).length > 3) { showNotification('warning', 'Spam', 'Tối đa 3 Icon 1 tin nhắn!', 'Đã hiểu'); return; }
    } else { if(!content && !window.selectedImageBase64) return; }

    try {
        let payload = { username: currentUser.username, content: content };
        if(window.selectedReplyMsg) payload.replyTo = window.selectedReplyMsg;
        if(window.selectedImageBase64) payload.image = window.selectedImageBase64;

        let res = await fetch('https://chunhatpham-online.onrender.com/api/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let data = await res.json();
        if (res.ok) {
            inputEl.value = ''; window.updateChatCounter(); window.cancelReply(); window.cancelImageUpload();
            await loadChatMessages();
            setTimeout(() => { let chatArea = document.getElementById('chat-messages-area'); if(chatArea) chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' }); }, 100);
        } else {
            showNotification('error', 'Từ Chối', data.message, 'Đã hiểu');
        }
    } catch (e) { showNotification('error', 'Lỗi Mạng', 'Không kết nối được với Server Chat', 'Đóng'); }
};

// ================= CÁC HÀM XỬ LÝ CONTEXT MENU =================
window.showChatContext = function(e, msgId, owner) {
    e.preventDefault(); e.stopPropagation();
    window.contextMsgId = msgId; window.contextMsgOwner = owner;
    let menu = document.getElementById('chat-context-menu'); let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    
    document.querySelectorAll('.ccm-action').forEach(el => el.style.display = 'flex'); 
    if(currentUser && (currentUser.role === 'admin' || currentUser.username === owner)) document.getElementById('ccm-delete-btn').style.display = 'flex'; else document.getElementById('ccm-delete-btn').style.display = 'none';
    if(currentUser && currentUser.role === 'admin') document.getElementById('ccm-pin-btn').style.display = 'flex'; else document.getElementById('ccm-pin-btn').style.display = 'none';

    menu.style.display = 'block';
    let x = e.clientX || (e.touches && e.touches[0].clientX); let y = e.clientY || (e.touches && e.touches[0].clientY);
    if (x + menu.offsetWidth > window.innerWidth) x = window.innerWidth - menu.offsetWidth - 10;
    if (y + menu.offsetHeight > window.innerHeight) y = window.innerHeight - menu.offsetHeight - 10;
    menu.style.left = `${x}px`; menu.style.top = `${y}px`; menu.classList.add('show');
};

window.showReactionMenu = function(e, msgId) {
    e.preventDefault(); e.stopPropagation(); window.contextMsgId = msgId;
    let menu = document.getElementById('chat-context-menu');
    document.querySelectorAll('.ccm-action').forEach(el => el.style.display = 'none'); 
    menu.style.display = 'block';
    let x = e.clientX; let y = e.clientY;
    if (x + menu.offsetWidth > window.innerWidth) x = window.innerWidth - menu.offsetWidth - 10;
    menu.style.left = `${x}px`; menu.style.top = `${y}px`; menu.classList.add('show');
};

document.addEventListener('click', (e) => {
    let menu = document.getElementById('chat-context-menu');
    if(menu && !menu.contains(e.target)) { menu.classList.remove('show'); menu.style.display = 'none'; }
});

window.sendReactionWrapper = function(emoji) { window.sendReaction(window.contextMsgId, emoji); };
window.sendReaction = async function(msgId, emoji) {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    if(!currentUser) { showNotification('warning', 'Yêu cầu', 'Đăng nhập để thả cảm xúc', 'OK'); return; }
    document.getElementById('chat-context-menu').classList.remove('show'); document.getElementById('chat-context-menu').style.display = 'none';
    try {
        await fetch(`https://chunhatpham-online.onrender.com/api/chat/${msgId}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser.username, emoji: emoji }) });
        window.loadChatMessages(); 
    } catch(e) {}
};

window.deleteSelectedMessage = async function() {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user')); document.getElementById('chat-context-menu').classList.remove('show'); document.getElementById('chat-context-menu').style.display = 'none';
    if(confirm("Bạn có chắc chắn muốn thu hồi tin nhắn này?")) {
        try {
            await fetch(`https://chunhatpham-online.onrender.com/api/chat/${window.contextMsgId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser.username }) });
            window.loadChatMessages();
        } catch(e) {}
    }
};

window.togglePinMessage = async function() {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user')); document.getElementById('chat-context-menu').classList.remove('show'); document.getElementById('chat-context-menu').style.display = 'none';
    try {
        await fetch(`https://chunhatpham-online.onrender.com/api/chat/${window.contextMsgId}/pin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser.username }) });
        window.loadChatMessages();
    } catch(e) {}
};
window.unpinCurrentMessage = async function() {
    let currentUser = JSON.parse(localStorage.getItem('cnp_current_user'));
    if(!window.currentPinnedMsgId) return;
    try {
        await fetch(`https://chunhatpham-online.onrender.com/api/chat/${window.currentPinnedMsgId}/pin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser.username }) });
        window.loadChatMessages();
    } catch(e) {}
};

window.scrollToPinned = function() { if(window.currentPinnedMsgId) window.scrollToMessage(window.currentPinnedMsgId); };
window.scrollToMessage = function(id) {
    let msgEl = document.getElementById(`msg-${id}`);
    if(msgEl) {
        let chatArea = document.getElementById('chat-messages-area');
        chatArea.scrollTo({ top: msgEl.offsetTop - 50, behavior: 'smooth' });
        msgEl.style.boxShadow = "0 0 20px rgba(0, 198, 255, 0.8)"; setTimeout(() => msgEl.style.boxShadow = "none", 1500);
    }
};

if(!window.chatUpdateInterval) {
    window.chatUpdateInterval = setInterval(() => { 
        let tabSingle = document.getElementById('tab-single'); let menu = document.getElementById('chat-context-menu');
        if (tabSingle && tabSingle.classList.contains('active') && (!menu || !menu.classList.contains('show'))) { window.loadChatMessages(); } 
    }, 5000);
}