// Biến toàn cục để lưu trữ các instance của Chart.js, sử dụng ID của canvas làm key.
let charts = {};

// Biến toàn cục cho các dữ liệu phụ (giữ lại theo yêu cầu)
let expenseChart = null; 
let myPieChart = null;
let myLineChart = null;

// Tạm thời giữ lại để tránh lỗi tham chiếu nếu có trong code cũ,
// nhưng sẽ sử dụng appDataStore thay thế
let globalCategories = []; 
let globalAccounts = [];

// --- KHO DỮ LIỆU TRUNG TÂM (appDataStore) ---
const appDataStore = {
    categories: [],
    accounts: [],
    
    async loadInitialData() {
        try {
            console.log("   Loading initial data store...");
            // Sử dụng các hàm tiện ích mới từ APIClient
            const [cats, accs] = await Promise.all([
                api.getCategories(), 
                api.getAccounts()
            ]);
            this.categories = cats;
            this.accounts = accs;
            // Cập nhật global vars cũ (nếu cần tương thích ngược)
            globalCategories = cats;
            globalAccounts = accs;

            console.log("✅ Initial data store loaded.", this);
        } catch (e) {
            console.error("CRITICAL: Failed to load initial data store.", e);
            alert("Lỗi nghiêm trọng: Không thể tải dữ liệu nền. Vui lòng F5 lại trang.");
            throw e; // Ném lỗi để dừng việc khởi tạo dashboard
        }
    }
};
// --- KẾT THÚC appDataStore ---

// --- Sự kiện khởi chạy ứng dụng ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Kiểm tra Token
    const token = localStorage.getItem('accessToken');
    if (!token) {
        window.location.href = './login.html';
        return;
    }

    // 2. Luôn luôn tải dữ liệu nền trước
    try {
        await appDataStore.loadInitialData();
    } catch (e) {
        // Nếu loadInitialData lỗi nghiêm trọng, ta dừng lại
        return;
    }
    
    // 3. Khởi tạo Dashboard và Sự kiện
    try {
        await loadUserInfo();
        await loadDashboard('month'); // Mặc định load theo tháng
        
        // Gắn sự kiện cho các nút lọc thời gian
        document.querySelectorAll('.btn-time-filter').forEach(btn => {
            btn.addEventListener('click', function() {
                const range = this.getAttribute('data-range');
                loadDashboard(range, this);
            });
        });

        // 4. Sự kiện Đăng xuất
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('accessToken');
            window.location.href = './login.html';
        });

    } catch (error) {
        console.error("Lỗi khởi tạo Dashboard:", error);
    }
});

// --- CÁC HÀM XỬ LÝ LOGIC ---

async function loadUserInfo() {
    try {
        // Giả định api.request là hàm fetch đã được bọc lại
        const user = await api.request('/users/me'); 
        
        const nameDisplay = document.getElementById('user-name-display');
        if (nameDisplay) {
            nameDisplay.textContent = user.full_name || user.username;
        }
    } catch (e) {
        console.log("Lỗi tải user:", e);
    }
}

// Hàm load dashboard có tham số timeRange và nút bấm (nếu có)
async function loadDashboard(timeRange, btnElement = null) {
    // Xử lý active button state
    if (btnElement) {
        document.querySelectorAll('.btn-group .btn-time-filter').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    } else {
        // Nếu không truyền nút, đặt active cho nút mặc định (month)
        const defaultBtn = document.querySelector(`.btn-time-filter[data-range="${timeRange}"]`);
        if (defaultBtn) defaultBtn.classList.add('active');
    }

    try {
        // Gọi API với tham số time_range (Sử dụng hàm request chung)
        // URL phải khớp với cấu hình backend: /reports/dashboard
        const stats = await api.request(`/reports/dashboard?time_range=${timeRange}`);

        // 1. Cập nhật số liệu thẻ
        updateCard('total-balance', stats.total_balance);
        updateCard('month-income', stats.monthly_income);
        updateCard('month-expense', stats.monthly_expense);
        updateCard('budget-left', stats.budget_left);

        // --- 1. BIỂU ĐỒ ĐƯỜNG (Dòng tiền theo ngày/tháng) ---
        // 
        renderChart('lineChart', 'line', {
            labels: stats.line_chart.labels,
            datasets: [
                { label: 'Thu nhập', data: stats.line_chart.income, borderColor: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.2)', fill: false, tension: 0.4 },
                { label: 'Chi tiêu', data: stats.line_chart.expense, borderColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.2)', fill: false, tension: 0.4 }
            ]
        }, 'Dòng tiền theo Ngày/Giờ', timeRange);

        // --- 2. BIỂU ĐỒ TRÒN 1 (Tổng Thu vs Chi) ---
        // 
        const totalIncome = stats.monthly_income || 0;
        const totalExpense = stats.monthly_expense || 0;
        const isTotalEmpty = totalIncome === 0 && totalExpense === 0;

        renderChart('pieTotal', 'doughnut', {
            labels: isTotalEmpty ? ['Chưa có dữ liệu'] : ["Thu nhập", "Chi tiêu"],
            datasets: [{ 
                data: isTotalEmpty ? [1] : [totalIncome, totalExpense],
                backgroundColor: isTotalEmpty ? ['#e0e0e0'] : ['#2ecc71', '#e74c3c'],
                hoverOffset: isTotalEmpty ? 0 : 4
            }]
        }, 'Tỷ lệ Thu nhập vs Chi tiêu');

        // --- 3. BIỂU ĐỒ TRÒN 2 (Danh mục Chi tiêu) ---
        // 
        const isExpenseEmpty = stats.pie_expense.data.length === 0;
        
        renderChart('pieExpense', 'doughnut', {
            labels: isExpenseEmpty ? ['Chưa có dữ liệu'] : stats.pie_expense.labels,
            datasets: [{ 
                data: isExpenseEmpty ? [1] : stats.pie_expense.data, 
                backgroundColor: isExpenseEmpty 
                    ? ['#e0e0e0'] 
                    : ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#e0e0e0']
            }]
        }, 'Cơ cấu Chi tiêu theo Danh mục');

        // --- 4. BIỂU ĐỒ TRÒN 3 (Danh mục Thu nhập) ---
        // 
        const isIncomeEmpty = stats.pie_income.data.length === 0;

        renderChart('pieIncome', 'doughnut', {
            labels: isIncomeEmpty ? ['Chưa có dữ liệu'] : stats.pie_income.labels,
            datasets: [{ 
                data: isIncomeEmpty ? [1] : stats.pie_income.data, 
                backgroundColor: isIncomeEmpty 
                    ? ['#e0e0e0'] 
                    : ['#4bc0c0', '#9966ff', '#ff9f40', '#ffcd56', '#c9cbcf', '#e0e0e0']
            }]
        }, 'Cơ cấu Thu nhập theo Danh mục');
        
        // --- 5. BIỂU ĐỒ CỘT (Ngân sách) ---
        // 
        const hasBudget = stats.budget_chart.labels.length > 0;
        
        const budgetLabels = hasBudget ? stats.budget_chart.labels : ['Chưa có ngân sách'];
        const budgetSpent = hasBudget ? stats.budget_chart.spent : [0];
        const budgetLimit = hasBudget ? stats.budget_chart.limit : [100000]; // Đặt limit giả cao hơn 0 để cột hiển thị

        renderChart('budgetChart', 'bar', {
            labels: budgetLabels,
            datasets: [
                { 
                    label: 'Đã chi', 
                    data: budgetSpent, 
                    backgroundColor: '#e74c3c', // Màu đỏ cho chi tiêu
                    borderRadius: 4,
                },
                { 
                    label: 'Hạn mức', 
                    data: budgetLimit, 
                    backgroundColor: '#2c3e50', // Màu tối cho hạn mức
                    borderRadius: 4,
                    // Giảm độ rộng cột hạn mức để hiển thị rõ cột chi tiêu
                    barPercentage: 0.8, 
                    categoryPercentage: 0.8,
                }
            ]
        }, 'Thực chi so với Ngân sách'); // Không cần truyền timeRange

    } catch (e) { 
        console.error("Lỗi tải dashboard:", e);
    }
}

// Hàm vẽ chart chung để tái sử dụng và quản lý destroy
function renderChart(canvasId, type, data, titleText = '') {
    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) {
        console.warn(`renderChart: canvas element not found: ${canvasId}`);
        return;
    }

    if (typeof Chart === 'undefined') {
        console.error('renderChart: Chart.js is not loaded.');
        return;
    }

    const ctx = canvasEl.getContext('2d');
    
    // Hủy biểu đồ cũ nếu tồn tại
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    // Cấu hình options mặc định
    const options = {
        responsive: true,
        maintainAspectRatio: false, // Quan trọng khi dùng trong div có chiều cao cố định
        plugins: {
            legend: { position: 'bottom' }, 
            title: {
                display: titleText.length > 0,
                text: titleText
            }
        },
        scales: type === 'line' || type === 'bar' ? {
            y: {
                beginAtZero: true
            }
        } : {}
    };

    // Cập nhật: Cấu hình riêng cho biểu đồ Ngân sách để nó nằm ngang
    if (canvasId === 'budgetChart') {
        options.indexAxis = 'y'; // Trục Y là trục danh mục (cột ngang)
        options.scales = {
            x: { // Đảm bảo trục X (giá trị) bắt đầu từ 0
                beginAtZero: true
            },
            y: { // Đảm bảo trục Y không có beginAtZero
                beginAtZero: false 
            }
        };
    }
    
    // Cập nhật: Cấu hình riêng cho biểu đồ đường (nếu không phải bar/line, scales là rỗng)
    if (type !== 'line' && type !== 'bar') {
        options.scales = {};
    }

    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: data,
        options: options
    });
}

function updateCard(elementId, amount) {
    const el = document.getElementById(elementId);
    if (el) {
        const numericAmount = parseFloat(amount) || 0; 
        el.textContent = new Intl.NumberFormat('vi-VN', { 
            style: 'currency', 
            currency: 'VND' 
        }).format(numericAmount);
    }
}

function formatCurrency(amount) {
    const numericAmount = parseFloat(amount) || 0; 
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numericAmount);
}

// Tạm thời để các hàm này rỗng hoặc loại bỏ nếu không sử dụng trong file này
async function loadDropdowns() {
    // Logic cho dropdowns (tài khoản, danh mục)
}

async function loadTransactionsList() {
    // Logic cho bảng danh sách giao dịch
}