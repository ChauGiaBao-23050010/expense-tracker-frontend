let currentAccountsList = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load user info for sidebar
    await loadUserInfo();
    
    // 2. Load accounts data and render
    await loadAccounts();
    
    // 3. Attach submit handler
    document.getElementById('accountForm').addEventListener('submit', handleSaveAccount);
});

/**
 * Tải thông tin người dùng cho Sidebar
 */
async function loadUserInfo() {
    try {
        const user = await api.request('/users/me');
        document.getElementById('user-name-display').textContent = user.full_name || user.username;
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${user.full_name || user.username}&background=random&color=fff`;
    } catch (e) {
        console.error("Lỗi tải thông tin người dùng:", e);
    }
}

/**
 * Tải danh sách tài khoản từ API
 */
async function loadAccounts() {
    try {
        const accounts = await api.request('/accounts/');
        currentAccountsList = accounts;
        renderCards(accounts);
    } catch (e) {
        console.error(e);
        showToast('Lỗi', 'Không thể tải danh sách tài khoản', 'text-danger');
    }
}

/**
 * Render danh sách tài khoản dưới dạng Card
 * @param {Array} accounts - Danh sách tài khoản
 */
function renderCards(accounts) {
    const container = document.getElementById('account-cards');
    container.innerHTML = '';

    if (accounts.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted p-5">Chưa có tài khoản nào được tạo. Hãy thêm ví mới!</div>';
        return;
    }

    let totalBalance = 0;
    
    accounts.forEach(acc => {
        totalBalance += acc.current_balance;
        const balance = Number(acc.current_balance).toLocaleString('vi-VN', {style : 'currency', currency : 'VND'});
        
        // Chọn icon theo loại ví
        let iconClass = 'fa-wallet';
        if (acc.type === 'Ngân hàng') iconClass = 'fa-university';
        else if (acc.type === 'Ví điện tử') iconClass = 'fa-mobile-alt';
        else if (acc.type === 'Tiết kiệm') iconClass = 'fa-piggy-bank';
        else if (acc.type === 'Đầu tư') iconClass = 'fa-chart-line';
        // Thẻ màu sắc dựa trên số dư
        const balanceColor = acc.current_balance >= 0 ? 'text-success' : 'text-danger';

        const card = `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="card h-100 shadow-sm border-0">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div class="d-flex align-items-center">
                                <div class="rounded-circle bg-light p-3 me-3 text-primary">
                                    <i class="fas ${iconClass} fa-lg"></i>
                                </div>
                                <div>
                                    <h5 class="card-title mb-0 fw-bold">${acc.name}</h5>
                                    <small class="text-muted">${acc.type}</small>
                                </div>
                            </div>
                            <div class="dropdown">
                                <button class="btn btn-link text-muted p-0" data-bs-toggle="dropdown">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end shadow">
                                    <li><a class="dropdown-item" href="#" 
                                        onclick="prepareEditMode(${acc.id})" 
                                        data-bs-toggle="modal" 
                                        data-bs-target="#accountModal">
                                        <i class="fas fa-edit me-2"></i>Chỉnh sửa
                                    </a></li>
                                    <li><a class="dropdown-item text-danger" href="#" onclick="deleteAccount(${acc.id})">
                                        <i class="fas fa-trash me-2"></i>Xóa ví
                                    </a></li>
                                </ul>
                            </div>
                        </div>
                        <h3 class="fw-bold ${balanceColor} mb-0">${balance}</h3>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
    
    // Nếu muốn hiển thị tổng số dư, có thể thêm vào đây
    // const total = totalBalance.toLocaleString('vi-VN', {style : 'currency', currency : 'VND'});
    // console.log(`Tổng số dư: ${total}`); 
}

/**
 * Chuẩn bị modal cho chế độ Thêm mới
 */
window.prepareAddMode = function() {
    document.getElementById('accountForm').reset();
    document.getElementById('accountId').value = ''; 
    document.getElementById('modalTitle').textContent = "Thêm Ví Mới";
    document.getElementById('current_balance').removeAttribute('readonly');
    document.querySelector('#accountForm .form-text.text-danger').textContent = "Lưu ý: Chỉ nên nhập số dư ban đầu khi tạo mới.";
}

/**
 * Chuẩn bị modal cho chế độ Chỉnh sửa
 * @param {number} id - ID tài khoản cần chỉnh sửa
 */
window.prepareEditMode = function(id) {
    const account = currentAccountsList.find(a => a.id === id);
    if (!account) return;

    document.getElementById('accountId').value = account.id;
    document.getElementById('name').value = account.name;
    document.getElementById('type').value = account.type;
    document.getElementById('current_balance').value = account.current_balance;
    
    document.getElementById('modalTitle').textContent = "Cập nhật Tài Khoản";
    document.getElementById('current_balance').setAttribute('readonly', 'readonly'); // Khóa trường số dư khi chỉnh sửa
    document.querySelector('#accountForm .form-text.text-danger').textContent = "Lưu ý: Số dư hiện tại thường được quản lý qua giao dịch. Trường này bị khóa khi chỉnh sửa.";
}

/**
 * Xử lý lưu (Thêm mới/Cập nhật) tài khoản
 */
async function handleSaveAccount(e) {
    e.preventDefault();
    
    const id = document.getElementById('accountId').value;
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

    const data = {
        name: document.getElementById('name').value,
        type: document.getElementById('type').value,
        current_balance: parseFloat(document.getElementById('current_balance').value)
    };

    try {
        if (id) {
            // Sửa
            await api.request(`/accounts/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showToast('Thành công', 'Cập nhật tài khoản thành công!', 'text-success');
        } else {
            // Thêm mới
            await api.request('/accounts/', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showToast('Thành công', 'Thêm tài khoản thành công!', 'text-success');
        }
        
        // Đóng modal và tải lại dữ liệu
        const modal = bootstrap.Modal.getInstance(document.getElementById('accountModal'));
        if (modal) modal.hide();
        loadAccounts();
        
    } catch (e) {
        showToast('Thất bại', 'Lỗi: ' + e.message, 'text-danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * Xử lý xóa tài khoản
 * @param {number} id - ID tài khoản cần xóa
 */
window.deleteAccount = async (id) => {
    if(!confirm("Bạn có chắc muốn xóa ví này? Tất cả giao dịch liên quan cũng có thể bị ảnh hưởng.")) return;
    try {
        await api.request(`/accounts/${id}`, { method: 'DELETE' });
        loadAccounts();
        showToast('Thành công', 'Đã xóa tài khoản thành công!', 'text-success');
    } catch (e) {
        showToast('Thất bại', "Lỗi khi xóa: " + e.message, 'text-danger');
    }
};


// Hàm hiển thị thông báo (Bổ sung để đảm bảo tính nhất quán)
function showToast(title, message, textColor = 'text-dark') {
    const toastEl = document.getElementById('liveToast');
    if (!toastEl) return; // Đảm bảo Toast element tồn tại

    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastTitle').className = `me-auto fw-bold ${textColor}`; 
    document.getElementById('toastMessage').textContent = message;
    
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}