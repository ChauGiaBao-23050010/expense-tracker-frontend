// Biến lưu trữ danh sách ngân sách hiện tại để dùng cho prepareEditMode
let currentBudgets = []; 

document.addEventListener('DOMContentLoaded', async () => {
    // Load User Info (giữ nguyên logic gốc)
    try {
        const user = await api.request('/users/me');
        document.getElementById('user-name-display').textContent = user.full_name || user.username;
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${user.full_name || user.username}&background=random&color=fff`;
    } catch (e) { console.error("Error loading user info:", e); }

    // Khởi tạo các hàm cần thiết
    initDateSelectors();
    await loadCategories();
    await loadBudgets(); // Gọi hàm tải và render bảng

    // Gắn sự kiện cho form
    document.getElementById('budgetForm').addEventListener('submit', handleSaveBudget);
    
    // Đảm bảo nút "Thêm mới" gọi hàm prepareAddMode
    const addBtn = document.querySelector('button[data-bs-target="#budgetModal"]');
    if(addBtn) {
        addBtn.setAttribute('onclick', 'prepareAddMode()');
    }
});

// Khởi tạo dropdown tháng/năm
function initDateSelectors() {
    const now = new Date();
    // Thay đổi: Không cần currentMonthDisplay vì HTML mới đã có tiêu đề tĩnh
    const monthSelect = document.getElementById('month');
    const yearSelect = document.getElementById('year');

    // Nếu monthSelect/yearSelect không tồn tại (vì đã xóa trong HTML mới), bỏ qua
    if (!monthSelect || !yearSelect) return; 

    // Reset nội dung
    monthSelect.innerHTML = '';
    yearSelect.innerHTML = '';

    // Tháng 1-12
    for (let i = 1; i <= 12; i++) {
        monthSelect.innerHTML += `<option value="${i}" ${i === now.getMonth() + 1 ? 'selected' : ''}>Tháng ${i}</option>`;
    }
    // Năm (Năm nay và năm sau)
    yearSelect.innerHTML += `<option value="${now.getFullYear()}" selected>${now.getFullYear()}</option>`;
    yearSelect.innerHTML += `<option value="${now.getFullYear() + 1}">${now.getFullYear() + 1}</option>`;
}

async function loadCategories() {
    try {
        const cats = await api.request('/categories/');
        const catSelect = document.getElementById('category_id');
        catSelect.innerHTML = '';
        
        // Chỉ lấy danh mục CHI TIÊU (EXPENSE)
        const expenseCats = cats.filter(c => c.type === 'EXPENSE');
        
        expenseCats.forEach(c => {
            // Hiển thị tên danh mục trong option
            catSelect.innerHTML += `<option value="${c.id}">${c.icon || '📁'} ${c.name}</option>`;
        });
    } catch (e) { console.error("Error loading categories:", e); }
}

async function loadBudgets() {
    const tbody = document.getElementById('budget-table-body');
    if (!tbody) return; 
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-primary"><i class="fas fa-spinner fa-spin"></i> Đang tải ngân sách...</td></tr>';

    try {
        // Mặc định gọi API không tham số để lấy tháng hiện tại
        const budgets = await api.request('/budgets/');
        
        // Lưu lại dữ liệu cho việc sửa
        currentBudgets = budgets; 

        renderTable(budgets);

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Lỗi: ${e.message}</td></tr>`;
    }
}

function renderTable(budgets) {
    const tbody = document.getElementById('budget-table-body');
    tbody.innerHTML = '';

    if (budgets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Chưa có ngân sách nào cho tháng này. Hãy tạo mới!</td></tr>';
        return;
    }

    budgets.forEach(b => {
        const spent = b.spent_amount;
        const limit = b.amount;
        const percent = limit > 0 ? (spent / limit) * 100 : 0;
        
        let progressClass = 'bg-success';
        let statusText = 'An toàn';
        
        if (percent > 100) { progressClass = 'bg-danger'; statusText = 'Vượt mức!'; }
        else if (percent > 80) { progressClass = 'bg-warning'; statusText = 'Sắp hết'; }
        
        // Giới hạn thanh max 100% để không vỡ layout
        const widthPercent = percent > 100 ? 100 : percent;

        const row = `
            <tr>
                <td><span class="me-2">${b.category_icon || '📁'}</span> ${b.category_name}</td>
                <td class="text-end text-success fw-bold">${formatMoney(limit)}</td>
                <td class="text-end text-danger">${formatMoney(spent)}</td>
                <td>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar ${progressClass} progress-bar-striped" 
                             role="progressbar" style="width: ${widthPercent}%">
                             ${Math.round(percent)}%
                        </div>
                    </div>
                    <small class="text-muted d-block text-end">${statusText}</small>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-warning me-1" 
                        data-bs-toggle="modal" 
                        data-bs-target="#budgetModal" 
                        onclick="prepareEditMode(${b.id})">
                        <i class="fas fa-edit"></i> Sửa
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteBudget(${b.id})">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Hàm Thêm mới: Mở Modal ở chế độ thêm
window.prepareAddMode = function() {
    document.getElementById('budgetForm').reset();
    document.getElementById('budgetId').value = '';
    document.getElementById('modalTitle').textContent = "Thêm Ngân sách mới";
    
    // Mở lại dropdown tháng/năm và set lại giá trị mặc định
    document.getElementById('category_id').disabled = false;
    
    // Sử dụng initDateSelectors để set lại tháng/năm hiện tại
    initDateSelectors();
    document.getElementById('month').disabled = false;
    document.getElementById('year').disabled = false;
}

// Hàm Sửa: Mở Modal và điền dữ liệu
window.prepareEditMode = function(id) {
    const budget = currentBudgets.find(b => b.id === id);
    if (!budget) return;

    document.getElementById('modalTitle').textContent = `Cập nhật Ngân sách cho ${budget.category_name}`;
    document.getElementById('budgetId').value = budget.id;
    document.getElementById('category_id').value = budget.category_id;
    document.getElementById('amount').value = budget.amount;
    
    // Khóa/Điền dropdown tháng và năm (Không cho sửa tháng/năm/danh mục khi cập nhật)
    document.getElementById('month').value = budget.month;
    document.getElementById('year').value = budget.year;
    document.getElementById('month').disabled = true;
    document.getElementById('year').disabled = true;
    document.getElementById('category_id').disabled = true;
}

// Xử lý Lưu (Thêm mới hoặc Cập nhật)
async function handleSaveBudget(e) {
    e.preventDefault();
    const id = document.getElementById('budgetId').value;
    const isEdit = !!id;

    // Dữ liệu cần gửi đi
    const data = {
        amount: parseFloat(document.getElementById('amount').value),
    };
    
    let method, url;

    if (isEdit) {
        // CHẾ ĐỘ SỬA: Chỉ cần gửi amount
        method = 'PUT';
        url = `/budgets/${id}`;
    } else {
        // CHẾ ĐỘ THÊM MỚI: Cần gửi month, year, category_id, amount
        method = 'POST';
        url = '/budgets/';
        data.month = parseInt(document.getElementById('month').value);
        data.year = parseInt(document.getElementById('year').value);
        data.category_id = parseInt(document.getElementById('category_id').value);
    }
    
    try {
        await api.request(url, {
            method: method,
            body: JSON.stringify(data)
        });
        
        alert(isEdit ? 'Cập nhật thành công!' : 'Thêm thành công!');
        
        // Đóng modal và tải lại dữ liệu
        const modal = bootstrap.Modal.getInstance(document.getElementById('budgetModal'));
        if (modal) modal.hide();
        loadBudgets();
        
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

// Xử lý Xóa
window.deleteBudget = async (id) => {
    if(!confirm("Xác nhận xóa ngân sách này?")) return;
    try {
        await api.request(`/budgets/${id}`, { method: 'DELETE' });
        alert('Đã xóa thành công!');
        loadBudgets();
    } catch (e) { 
        alert('Lỗi khi xóa: ' + e.message); 
    }
};

// Hàm định dạng tiền tệ
function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}