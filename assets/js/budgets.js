// Biến lưu trữ danh sách ngân sách hiện tại để dùng cho prepareEditMode
let currentBudgets = []; 

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load User Info (Header)
    try {
        const user = await api.request('/users/me');
        const nameDisplay = document.getElementById('user-name-display');
        const avatarDisplay = document.getElementById('user-avatar');
        
        if (nameDisplay) nameDisplay.textContent = user.full_name || user.username;
        if (avatarDisplay) avatarDisplay.src = `https://ui-avatars.com/api/?name=${user.full_name || user.username}&background=random&color=fff`;
    } catch (e) { console.error("Error loading user info:", e); }

    // 2. Khởi tạo dữ liệu
    initDateSelectors(); // Tạo option cho dropdown tháng/năm
    await loadCategories(); // Tải danh sách danh mục
    await loadBudgets(); // Tải danh sách ngân sách

    // 3. Gắn sự kiện submit form
    const budgetForm = document.getElementById('budgetForm');
    if (budgetForm) {
        budgetForm.addEventListener('submit', handleSaveBudget);
    }
});

// --- CÁC HÀM KHỞI TẠO ---

function initDateSelectors() {
    const monthSelect = document.getElementById('month');
    const yearSelect = document.getElementById('year');
    const now = new Date();

    if (monthSelect) {
        monthSelect.innerHTML = '';
        for (let i = 1; i <= 12; i++) {
            const selected = (i === now.getMonth() + 1) ? 'selected' : '';
            monthSelect.innerHTML += `<option value="${i}" ${selected}>Tháng ${i}</option>`;
        }
    }

    if (yearSelect) {
        yearSelect.innerHTML = '';
        const currentYear = now.getFullYear();
        // Cho phép chọn năm nay và năm sau
        yearSelect.innerHTML += `<option value="${currentYear}" selected>${currentYear}</option>`;
        yearSelect.innerHTML += `<option value="${currentYear + 1}">${currentYear + 1}</option>`;
    }
}

async function loadCategories() {
    try {
        const cats = await api.request('/categories/');
        const catSelect = document.getElementById('category_id');
        
        if (!catSelect) return;
        catSelect.innerHTML = '';
        
        // Chỉ lấy danh mục CHI TIÊU (EXPENSE) vì ngân sách thường đặt cho chi tiêu
        const expenseCats = cats.filter(c => c.type === 'EXPENSE');
        
        if (expenseCats.length === 0) {
            catSelect.innerHTML = '<option value="" disabled>Chưa có danh mục chi tiêu nào</option>';
            return;
        }

        expenseCats.forEach(c => {
            catSelect.innerHTML += `<option value="${c.id}">${c.icon || '📁'} ${c.name}</option>`;
        });
    } catch (e) { console.error("Error loading categories:", e); }
}

async function loadBudgets() {
    const tbody = document.getElementById('budget-table-body');
    if (!tbody) return; 
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-primary"><i class="fas fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>';

    try {
        // Lấy toàn bộ ngân sách (Backend có thể trả về list các tháng)
        // Nếu muốn filter theo tháng hiện tại, có thể thêm query param: ?month=...&year=...
        const budgets = await api.request('/budgets/');
        currentBudgets = budgets; // Lưu lại để dùng khi bấm Sửa
        renderTable(budgets);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Lỗi: ${e.message}</td></tr>`;
    }
}

function renderTable(budgets) {
    const tbody = document.getElementById('budget-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!budgets || budgets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Chưa có ngân sách nào. Hãy tạo mới!</td></tr>';
        return;
    }

    budgets.forEach(b => {
        const spent = b.spent_amount || 0;
        const limit = b.amount;
        const percent = limit > 0 ? (spent / limit) * 100 : 0;
        
        let progressClass = 'bg-success';
        let statusText = 'An toàn';
        
        if (percent > 100) { progressClass = 'bg-danger'; statusText = 'Vượt mức!'; }
        else if (percent > 80) { progressClass = 'bg-warning'; statusText = 'Sắp hết'; }
        
        const widthPercent = percent > 100 ? 100 : percent;

        const row = `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <span class="me-2 fs-5">${b.category_icon || '📁'}</span>
                        <div>
                            <div class="fw-bold">${b.category_name}</div>
                            <small class="text-muted">Tháng ${b.month}/${b.year}</small>
                        </div>
                    </div>
                </td>
                <td class="text-end text-success fw-bold">${formatMoney(limit)}</td>
                <td class="text-end text-danger">${formatMoney(spent)}</td>
                <td style="min-width: 150px;">
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar ${progressClass} progress-bar-striped" 
                             role="progressbar" style="width: ${widthPercent}%">
                             ${Math.round(percent)}%
                        </div>
                    </div>
                    <small class="text-muted d-block text-end">${statusText}</small>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary me-1" 
                        data-bs-toggle="modal" 
                        data-bs-target="#budgetModal" 
                        onclick="prepareEditMode(${b.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteBudget(${b.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// --- CÁC HÀM XỬ LÝ SỰ KIỆN ---

// Chế độ THÊM MỚI
window.prepareAddMode = function() {
    const form = document.getElementById('budgetForm');
    if (form) form.reset();

    document.getElementById('budgetId').value = ''; // ID rỗng -> Thêm mới
    document.getElementById('modalTitle').textContent = "Thêm Ngân sách mới";
    
    // Mở khóa các trường (vì thêm mới được quyền chọn tháng/năm/danh mục)
    document.getElementById('month').disabled = false;
    document.getElementById('year').disabled = false;
    document.getElementById('category_id').disabled = false;

    // Reset về tháng hiện tại
    initDateSelectors();
}

// Chế độ CHỈNH SỬA
window.prepareEditMode = function(id) {
    const budget = currentBudgets.find(b => b.id === id);
    if (!budget) return;

    document.getElementById('modalTitle').textContent = `Cập nhật Ngân sách`;
    document.getElementById('budgetId').value = budget.id;
    document.getElementById('amount').value = budget.amount;
    
    // Điền giá trị cũ
    document.getElementById('month').value = budget.month;
    document.getElementById('year').value = budget.year;
    document.getElementById('category_id').value = budget.category_id;

    // Khóa các trường không được sửa (logic backend thường không cho sửa key)
    document.getElementById('month').disabled = true;
    document.getElementById('year').disabled = true;
    document.getElementById('category_id').disabled = true;
}

// Xử lý LƯU (Submit Form)
async function handleSaveBudget(e) {
    e.preventDefault();
    
    const id = document.getElementById('budgetId').value;
    const isEdit = !!id; // Nếu có ID là đang sửa

    // Lấy dữ liệu từ form
    const amount = parseFloat(document.getElementById('amount').value);
    
    // Validate cơ bản
    if (isNaN(amount) || amount <= 0) {
        alert("Vui lòng nhập số tiền hợp lệ!");
        return;
    }

    try {
        let url, method, bodyData;

        if (isEdit) {
            // SỬA: Chỉ gửi amount (PUT)
            url = `/budgets/${id}`;
            method = 'PUT';
            bodyData = { amount: amount };
        } else {
            // THÊM: Gửi đầy đủ thông tin (POST)
            url = '/budgets/';
            method = 'POST';
            bodyData = {
                month: parseInt(document.getElementById('month').value),
                year: parseInt(document.getElementById('year').value),
                category_id: parseInt(document.getElementById('category_id').value),
                amount: amount
            };
        }

        // Gọi API
        await api.request(url, {
            method: method,
            body: JSON.stringify(bodyData)
        });
        
        // Thành công
        const modalEl = document.getElementById('budgetModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide(); // Đóng modal
        
        await loadBudgets(); // Tải lại bảng
        alert(isEdit ? 'Cập nhật thành công!' : 'Thêm mới thành công!');

    } catch (e) {
        console.error(e);
        alert('Lỗi: ' + e.message);
    }
}

// Xử lý XÓA
window.deleteBudget = async (id) => {
    if(!confirm("Bạn có chắc muốn xóa ngân sách này?")) return;
    
    try {
        await api.request(`/budgets/${id}`, { method: 'DELETE' });
        await loadBudgets(); // Tải lại bảng sau khi xóa
    } catch (e) { 
        alert('Lỗi khi xóa: ' + e.message); 
    }
};

function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}