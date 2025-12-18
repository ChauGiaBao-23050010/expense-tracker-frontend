// --- BIẾN TOÀN CỤC ---
let currentInvestments = [];
let historyChart = null;
// Khởi tạo đối tượng Bootstrap Modal ngay khi tải script
const investmentModal = new bootstrap.Modal(document.getElementById('investmentModal'));
const detailModal = new bootstrap.Modal(document.getElementById('detailModal'));

// --- KHỞI CHẠY ---
document.addEventListener('DOMContentLoaded', () => {
    initializeInvestmentPage();
});

async function initializeInvestmentPage() {
    setupEventListeners();
    await loadInvestments();
}

// --- GẮN SỰ KIỆN (EVENT DELEGATION) ---
function setupEventListeners() {
    document.getElementById('investmentForm').addEventListener('submit', handleSaveInvestment);
    document.getElementById('updateValueForm').addEventListener('submit', handleUpdateValue);

    // Dùng event delegation cho các nút được tạo động trong investmentList
    document.getElementById('investmentList').addEventListener('click', (e) => {
        const target = e.target.closest('button, a');
        if (!target) return;

        // Lấy ID từ data-id của phần tử gần nhất (button hoặc a)
        const id = parseInt(target.dataset.id);
        if (isNaN(id)) return;

        if (target.matches('.btn-edit')) {
            e.preventDefault();
            prepareEditMode(id);
        } else if (target.matches('.btn-delete')) {
            e.preventDefault();
            deleteInvestment(id);
        } else if (target.matches('.btn-detail')) {
            e.preventDefault();
            showDetail(id);
        }
    });
}

// --- TẢI VÀ HIỂN THỊ DỮ LIỆU ---
async function loadInvestments() {
    const listEl = document.getElementById('investmentList');
    listEl.innerHTML = '<div class="text-center w-100"><div class="spinner-border"></div></div>';
    try {
        const investments = await api.request('/investments/');
        currentInvestments = investments;
        renderInvestmentCards(investments);
        updateSummaryCards(investments); // CẬP NHẬT THẺ TỔNG QUAN
    } catch (e) {
        listEl.innerHTML = '<p class="text-danger w-100 text-center">Lỗi tải dữ liệu.</p>';
        updateSummaryCards([]); // Reset tổng quan nếu lỗi
    }
}

function renderInvestmentCards(investments) {
    const listEl = document.getElementById('investmentList');
    listEl.innerHTML = '';

    if (investments.length === 0) {
        listEl.innerHTML = '<p class="text-muted text-center w-100">Chưa có khoản đầu tư nào. Hãy thêm mới!</p>';
        return;
    }
    
    // Sử dụng map và join để tối ưu hiệu năng DOM
    const cardsHtml = investments.map(inv => {
        const profit = inv.current_value - inv.initial_value;
        const profitPercentage = inv.initial_value > 0 ? (profit / inv.initial_value) * 100 : 0;
        const profitClass = profit >= 0 ? 'text-success' : 'text-danger';
        
        return `
            <div class="col-md-4 mb-4">
                <div class="card shadow-sm h-100">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h5 class="card-title">${inv.name}</h5>
                                <h6 class="card-subtitle mb-2 text-muted">${inv.type || ''}</h6>
                            </div>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-light" type="button" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-v"></i></button>
                                <ul class="dropdown-menu">
                                    <li><a class="dropdown-item btn-edit" href="#" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#investmentModal">Sửa thông tin</a></li>
                                    <li><a class="dropdown-item text-danger btn-delete" href="#" data-id="${inv.id}">Xóa</a></li>
                                </ul>
                            </div>
                        </div>
                        <p class="card-text fs-4 fw-bold mt-2">${formatCurrency(inv.current_value)}</p>
                        <p class="card-text ${profitClass}">${profit >= 0 ? '+' : ''}${formatCurrency(profit)} (${profitPercentage.toFixed(2)}%)</p>
                        <button class="btn btn-outline-primary btn-sm mt-auto btn-detail" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#detailModal">Cập nhật / Xem chi tiết</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    listEl.innerHTML = cardsHtml;
}

// --- HÀM MỚI: CẬP NHẬT THẺ TỔNG QUAN ---
function updateSummaryCards(investments) {
    const totalInitial = investments.reduce((sum, inv) => sum + parseFloat(inv.initial_value || 0), 0);
    const totalCurrent = investments.reduce((sum, inv) => sum + parseFloat(inv.current_value || 0), 0);
    const totalProfit = totalCurrent - totalInitial;

    document.getElementById('total-initial').textContent = formatCurrency(totalInitial);
    document.getElementById('total-current').textContent = formatCurrency(totalCurrent);
    document.getElementById('total-profit').textContent = `${totalProfit >= 0 ? '+' : ''}${formatCurrency(totalProfit)}`;

    // Thay đổi màu nền của thẻ Lời/Lỗ
    const profitCard = document.getElementById('total-profit-card');
    profitCard.classList.remove('bg-gradient-success', 'bg-gradient-danger', 'bg-gradient-secondary');
    if (totalProfit > 0) {
        profitCard.classList.add('bg-gradient-success');
    } else if (totalProfit < 0) {
        profitCard.classList.add('bg-gradient-danger');
    } else {
        profitCard.classList.add('bg-gradient-secondary');
    }
}

// --- XỬ LÝ FORM MODAL ---
function prepareAddMode() {
    document.getElementById('investmentForm').reset();
    document.getElementById('investmentId').value = '';
    document.getElementById('investmentModalTitle').textContent = "Thêm Khoản Đầu Tư";
    document.getElementById('start_date').value = new Date().toISOString().split('T')[0];
}

function prepareEditMode(id) {
    // Sửa lỗi so sánh: ID đã được parseInt() từ event delegation
    const inv = currentInvestments.find(i => i.id === id); 
    if (!inv) return;
    
    document.getElementById('investmentModalTitle').textContent = "Sửa Khoản Đầu Tư";
    document.getElementById('investmentId').value = inv.id;
    document.getElementById('name').value = inv.name;
    document.getElementById('type').value = inv.type || '';
    document.getElementById('initial_value').value = inv.initial_value;
    document.getElementById('start_date').value = new Date(inv.start_date).toISOString().split('T')[0];
    
    investmentModal.show(); // Hiển thị modal sau khi điền dữ liệu
}

async function handleSaveInvestment(e) {
    e.preventDefault();
    const id = document.getElementById('investmentId').value;
    const data = {
        name: document.getElementById('name').value,
        type: document.getElementById('type').value,
        initial_value: document.getElementById('initial_value').value,
        start_date: document.getElementById('start_date').value,
    };

    try {
        if (id) {
            await api.request(`/investments/${id}/info`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
            await api.request('/investments/', { method: 'POST', body: JSON.stringify(data) });
        }
        investmentModal.hide();
        await loadInvestments();
    } catch (err) { alert(err.message); }
}

async function deleteInvestment(id) {
    if (!confirm("Bạn có chắc muốn xóa khoản đầu tư này? Toàn bộ lịch sử giá sẽ bị mất vĩnh viễn.")) return;
    try {
        await api.request(`/investments/${id}`, { method: 'DELETE' });
        await loadInvestments();
    } catch(err) { alert("Lỗi khi xóa: " + err.message); }
}

// --- XỬ LÝ MODAL CHI TIẾT ---
async function showDetail(id) {
    try {
        const detail = await api.request(`/investments/${id}`);
        
        document.getElementById('detailModalTitle').textContent = `Chi tiết: ${detail.name}`;
        document.getElementById('detailInvestmentId').value = id;
        document.getElementById('detailInitialValue').textContent = formatCurrency(detail.initial_value);
        
        const profit = detail.current_value - detail.initial_value;
        const profitEl = document.getElementById('detailProfitLoss');
        profitEl.textContent = `${profit >= 0 ? '+' : ''}${formatCurrency(profit)}`;
        profitEl.className = profit >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold';
        
        const ctx = document.getElementById('historyChart').getContext('2d');
        if (historyChart) historyChart.destroy();
        
        // Sắp xếp dữ liệu theo ngày trước khi vẽ biểu đồ (lưu ý: code gốc thiếu phần này)
        const sortedUpdates = detail.updates.sort((a, b) => new Date(a.update_date) - new Date(b.update_date));

        historyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedUpdates.map(u => new Date(u.update_date).toLocaleDateString('vi-VN')),
                datasets: [{
                    label: 'Giá trị',
                    data: sortedUpdates.map(u => u.value),
                    borderColor: '#36a2eb',
                    tension: 0.1
                }]
            }
        });

        detailModal.show(); // Hiển thị modal chi tiết
        
    } catch(e) { alert(e.message); }
}

async function handleUpdateValue(e) {
    e.preventDefault();
    const id = document.getElementById('detailInvestmentId').value;
    const data = { current_value: document.getElementById('current_value').value };
    
    try {
        await api.request(`/investments/${id}/value`, { method: 'PUT', body: JSON.stringify(data) });
        detailModal.hide();
        await loadInvestments();
    } catch(err) { alert(err.message); }
}

// --- HÀM TIỆN ÍCH ---
function formatCurrency(amount) {
    return Number(amount).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
}