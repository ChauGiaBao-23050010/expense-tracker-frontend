// Biến lưu chart instances
let reportCharts = {};

document.addEventListener('DOMContentLoaded', async () => {
    // Điền dropdown tài khoản
    const accSelect = document.getElementById('account_filter');
    try {
        const accounts = await api.request('/accounts/');
        accounts.forEach(a => accSelect.innerHTML += `<option value="${a.id}">${a.name}</option>`);
    } catch (e) { console.error(e); }

    // Mặc định ngày
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('end_date').valueAsDate = today;
    document.getElementById('start_date').valueAsDate = firstDayOfMonth;

    // Gắn sự kiện cho form
    document.getElementById('reportForm').addEventListener('submit', handleGenerateReport);
    
    // Tự động chạy báo cáo lần đầu
    handleGenerateReport(new Event('submit'));
});

// Thêm hàm format tiền tệ
function formatCurrency(amount) {
    if (typeof amount !== 'number') return '0 đ';
    // Sử dụng Intl.NumberFormat để định dạng VNĐ chuẩn
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}


async function handleGenerateReport(e) {
    e.preventDefault();
    const btn = document.querySelector('#reportForm button[type="submit"]');
    const originalText = btn.innerHTML;
    
    // --- CẬP NHẬT TRẠNG THÁI LOADING START ---
    // Ẩn nội dung cũ, hiện loading
    document.getElementById('reportContent').classList.add('d-none');
    // Giả định có một element với ID 'loadingState' để hiển thị spinner/thông báo đang tải
    const loadingStateElement = document.getElementById('loadingState');
    if (loadingStateElement) {
        loadingStateElement.classList.remove('d-none');
    }
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang tải...`;
    // ------------------------------------------

    try {
        const startDate = document.getElementById('start_date').value;
        const endDate = document.getElementById('end_date').value;
        const accountId = document.getElementById('account_filter').value;
        
        // --- BƯỚC 1: THÊM KIỂM TRA NGÀY THÁNG BẮT BUỘC ---
        if (!startDate || !endDate) {
            // Ném lỗi nếu thiếu ngày bắt đầu hoặc ngày kết thúc
            throw new Error("Vui lòng chọn cả ngày bắt đầu và ngày kết thúc.");
        }
        // -----------------------------------------------------

        const params = new URLSearchParams({
            start_date: startDate,
            end_date: endDate,
        });
        
        if (accountId) {
            params.append('account_id', accountId);
        }

        const reportData = await api.request(`/reports/detailed?${params.toString()}`);

        document.getElementById('reportContent').classList.remove('d-none');

        // --- LOGIC MỚI: CẬP NHẬT SUMMARY CARDS ---
        const summary = reportData.summary;
        
        // 1. Cập nhật giá trị
        document.getElementById('summary-income').textContent = formatCurrency(summary.total_income);
        document.getElementById('summary-expense').textContent = formatCurrency(summary.total_expense);
        document.getElementById('summary-net').textContent = formatCurrency(summary.net_balance);
        
        // 2. Đổi màu thẻ Số dư ròng tùy theo âm hay dương
        const netBalanceCard = document.getElementById('net-balance-card');
        
        // Loại bỏ các class màu cũ
        netBalanceCard.classList.remove('bg-gradient-primary', 'bg-gradient-warning');

        if (summary.net_balance >= 0) {
            // Sử dụng màu chính (Primary) cho số dư ròng dương
            netBalanceCard.classList.add('bg-gradient-primary');
        } else {
            // Sử dụng màu cảnh báo (Warning) cho số dư ròng âm
            netBalanceCard.classList.add('bg-gradient-warning');
        }
        // ----------------------------------------

        // Vẽ biểu đồ đường
        renderReportChart('reportLineChart', 'line', {
            labels: reportData.line_chart.labels,
            datasets: [
                { label: 'Thu nhập', data: reportData.line_chart.income, borderColor: '#2ecc71', tension: 0.3 },
                { label: 'Chi tiêu', data: reportData.line_chart.expense, borderColor: '#e74c3c', tension: 0.3 }
            ]
        });

        // Xử lý phân tích Chi tiêu
        renderAnalysis('expense', reportData.expense_analysis);
        
        // Xử lý phân tích Thu nhập
        renderAnalysis('income', reportData.income_analysis);

    } catch (err) {
        alert(err.message || "Đã xảy ra lỗi không xác định.");
    } finally {
        // --- ẨN TRẠNG THÁI LOADING END ---
        const loadingStateElement = document.getElementById('loadingState');
        if (loadingStateElement) {
            loadingStateElement.classList.add('d-none');
        }
        btn.disabled = false;
        btn.innerHTML = originalText;
        // --------------------------------
    }
}

function renderAnalysis(type, data) {
    const pieCanvasId = `reportPie${type.charAt(0).toUpperCase() + type.slice(1)}`;
    const tableHeadId = `${type}-table-head`;
    const tableBodyId = `${type}-table-body`;

    // Vẽ biểu đồ tròn
    renderReportChart(pieCanvasId, 'doughnut', {
        labels: data.length > 0 ? data.map(d => d.category) : ['Không có dữ liệu'],
        datasets: [{
            data: data.length > 0 ? data.map(d => d.total) : [1],
            // Thêm màu sắc khác nhau để biểu đồ dễ nhìn hơn
            backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#c2e0b5', '#f8d568', '#42a5f5', '#66bb6a', '#ef5350', '#ab47bc']
        }]
    });

    // Vẽ bảng thống kê
    const thead = document.getElementById(tableHeadId);
    const tbody = document.getElementById(tableBodyId);
    
    thead.innerHTML = `<tr><th>Danh mục</th><th class="text-end">Số tiền</th><th class="text-center">Số GD</th></tr>`;
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Không có dữ liệu.</td></tr>';
        return;
    }
    
    const total = data.reduce((sum, item) => sum + item.total, 0);

    data.forEach(item => {
        const percentage = total > 0 ? ((item.total / total) * 100).toFixed(1) : 0;
        tbody.innerHTML += `
            <tr>
                <td>${item.category} <span class="text-muted">(${percentage}%)</span></td>
                <td class="text-end">${formatCurrency(item.total)}</td>
                <td class="text-center">${item.count}</td>
            </tr>
        `;
    });
    
    // Thêm dòng tổng
    tbody.innerHTML += `
        <tr class="table-light fw-bold">
            <td>Tổng cộng</td>
            <td class="text-end">${formatCurrency(total)}</td>
            <td class="text-center">${data.reduce((sum, item) => sum + item.count, 0)}</td>
        </tr>
    `;
}


function renderReportChart(canvasId, type, data) {
    if (reportCharts[canvasId]) {
        reportCharts[canvasId].destroy();
    }
    const ctx = document.getElementById(canvasId).getContext('2d');
    reportCharts[canvasId] = new Chart(ctx, {
        type: type,
        data: data,
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: type !== 'bar' } } }
    });
}