// --- BIẾN TOÀN CỤC ---
let allCategories = [];         // Lưu danh sách danh mục gốc từ server
let accountsMap = {};           // Map ID -> Tên tài khoản để hiển thị nhanh
let categoriesMap = {};         // Map ID -> Tên danh mục để hiển thị nhanh
let currentTransactionsList = []; // Lưu danh sách giao dịch hiện tại để Sửa nhanh

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Tải dữ liệu ban đầu và điền vào dropdown (cả modal và filter)
    await loadDropdowns();
    await loadTransactions(); // Load lần đầu (không có filter)

    // 2. Lắng nghe sự kiện thay đổi Loại giao dịch (Thu/Chi/Chuyển) trong MODAL
    // LƯU Ý: Sự kiện này đã được xử lý bằng onchange="toggleTransferUI()" trong HTML, 
    // nên không cần lắng nghe sự kiện change ở đây nữa.
    // Dù sao, ta vẫn giữ lại hàm filterCategoriesByType trong event listener cho mục đích đồng bộ
    document.getElementById('type').addEventListener('change', (e) => {
        filterCategoriesByType(e.target.value);
    });

    // 3. Lắng nghe sự kiện Submit Form THÊM/SỬA
    document.getElementById('transactionForm').addEventListener('submit', handleSaveTransaction);

    // 4. Lắng nghe sự kiện Submit Form LỌC
    document.getElementById('filterForm').addEventListener('submit', (e) => {
        e.preventDefault();
        loadTransactions(); // Gọi lại hàm load với dữ liệu từ form lọc
    });
});


// --- CẬP NHẬT GIAO DIỆN FORM CHO CHUYỂN TIỀN (HÀM MỚI/CẬP NHẬT) ---

window.toggleTransferUI = function() {
    const type = document.getElementById('type').value;
    const groupCategory = document.getElementById('group_category');
    const groupDest = document.getElementById('group_destination');
    const categorySelect = document.getElementById('category_id');
    const destSelect = document.getElementById('destination_account_id');

    if (type === 'TRANSFER') {
        // Chế độ Chuyển tiền: Ẩn danh mục, Hiện ví đích
        groupCategory.style.display = 'none';
        groupDest.style.display = 'block';
        
        categorySelect.removeAttribute('required'); // Bỏ bắt buộc danh mục
        destSelect.setAttribute('required', 'true'); // Bắt buộc ví đích
    } else {
        // Chế độ Thu/Chi: Hiện danh mục, Ẩn ví đích
        groupCategory.style.display = 'block';
        groupDest.style.display = 'none';
        
        categorySelect.setAttribute('required', 'true');
        destSelect.removeAttribute('required');
        
        // Lọc danh mục theo loại (Thu/Chi)
        filterCategoriesByType(type);
    }
}


// --- TẢI DỮ LIỆU (CẬP NHẬT) ---

async function loadDropdowns() {
    try {
        const [cats, accs] = await Promise.all([
            api.request('/categories/'),
            api.request('/accounts/')
        ]);
        
        allCategories = cats; // Lưu lại để dùng cho hàm lọc

        // 1. Chuẩn bị các biến DOM
        const catSelectModal = document.getElementById('category_id');
        const accSelectModal = document.getElementById('account_id');
        const destAccSelectModal = document.getElementById('destination_account_id'); // CẬP NHẬT
        const catSelectFilter = document.getElementById('filter_category');
        const accSelectFilter = document.getElementById('filter_account');
        
        // Reset và thêm option "Tất cả" cho Filter
        catSelectFilter.innerHTML = '<option value="">Tất cả danh mục</option>';
        accSelectFilter.innerHTML = '<option value="">Tất cả tài khoản</option>';
        catSelectModal.innerHTML = '';
        accSelectModal.innerHTML = '';
        destAccSelectModal.innerHTML = ''; // CẬP NHẬT


        // 2. Điền dữ liệu
        cats.forEach(c => {
            categoriesMap[c.id] = c.name;
            const optionHTML = `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`;
            
            // Điền vào cả Modal và Filter
            catSelectModal.innerHTML += optionHTML;
            catSelectFilter.innerHTML += optionHTML;
        });

        accs.forEach(a => {
            accountsMap[a.id] = a.name;
            const optionHTML = `<option value="${a.id}">${a.name}</option>`;
            
            // Điền vào cả Modal và Filter
            accSelectModal.innerHTML += optionHTML;
            accSelectFilter.innerHTML += optionHTML;
            destAccSelectModal.innerHTML += optionHTML; // CẬP NHẬT: Điền vào cả ô đích
        });

        // Mặc định load danh mục cho EXPENSE (Chi tiêu) lần đầu
        filterCategoriesByType('EXPENSE');
        toggleTransferUI(); // CẬP NHẬT: Mặc định hiển thị cho EXPENSE
    } catch (e) {
        console.error("Lỗi tải dropdown:", e);
    }
}

// Hàm lọc danh mục theo loại (Thu nhập / Chi tiêu)
function filterCategoriesByType(type) {
    // Chỉ lọc cho EXPENSE và INCOME
    if (type === 'TRANSFER') return;

    const catSelect = document.getElementById('category_id');
    catSelect.innerHTML = '';
    
    // Lọc các danh mục có type khớp với lựa chọn
    const filtered = allCategories.filter(c => c.type === type);
    
    if (filtered.length === 0) {
        catSelect.innerHTML = '<option value="">Chưa có danh mục loại này</option>';
    } else {
        filtered.forEach(c => {
            catSelect.innerHTML += `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`;
        });
    }
}

// CẬP NHẬT: Hàm loadTransactions mới nhận tham số lọc (Giữ nguyên)
async function loadTransactions() {
    try {
        // Lấy giá trị từ bộ lọc
        const search = document.getElementById('filter_search').value;
        const type = document.getElementById('filter_type').value;
        const accountId = document.getElementById('filter_account').value;
        const categoryId = document.getElementById('filter_category').value;
        const startDate = document.getElementById('filter_start_date').value;
        const endDate = document.getElementById('filter_end_date').value;

        // Tạo URL params
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        // Backend cần nhận ENUM type
        if (type) params.append('type', type); 
        if (accountId) params.append('account_id', accountId);
        if (categoryId) params.append('category_id', categoryId);
        // Backend cần nhận date
        if (startDate) params.append('start_date', startDate); 
        if (endDate) params.append('end_date', endDate);

        // Gọi API với params
        const allTrans = await api.request(`/transactions/?${params.toString()}`);
        
        // Sắp xếp và lưu vào biến toàn cục
        allTrans.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
        currentTransactionsList = allTrans; 
        
        renderTable(allTrans);
    } catch (e) { 
        console.error("Lỗi tải giao dịch:", e);
    }
}


// --- HIỂN THỊ GIAO DIỆN (Giữ nguyên, logic hiển thị chuyển khoản đã đúng) ---

function renderTable(transactions) {
    const tbody = document.getElementById('transaction-table-body');
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Không tìm thấy giao dịch nào.</td></tr>';
        return;
    }

    transactions.forEach(t => {
        const typeClass = t.type === 'EXPENSE' ? 'text-expense' : t.type === 'INCOME' ? 'text-income' : 'text-secondary';
        const typeLabel = t.type === 'EXPENSE' ? 'Chi tiêu' : t.type === 'INCOME' ? 'Thu nhập' : 'Chuyển tiền';
        const sign = t.type === 'EXPENSE' ? '-' : (t.type === 'INCOME' ? '+' : '');

        // Format ngày giờ Việt Nam: 14/12/2025 14:30
        const dateObj = new Date(t.transaction_date);
        const dateStr = dateObj.toLocaleDateString('vi-VN') + ' ' + 
                        dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        
        // Hiển thị thông tin tài khoản đích cho giao dịch TRANSFER
        const accountDisplay = t.type === 'TRANSFER' && t.destination_account_id
            ? `${accountsMap[t.source_account_id] || 'N/A'} <i class="fas fa-arrow-right mx-1 text-muted"></i> ${accountsMap[t.destination_account_id] || 'N/A'}`
            : accountsMap[t.source_account_id] || 'N/A';
        
        const categoryBadge = t.type === 'TRANSFER'
            ? '<span class="badge bg-secondary">Chuyển khoản</span>'
            : `<span class="badge bg-secondary">${categoriesMap[t.category_id] || 'N/A'}</span>`;

        const row = `
            <tr>
                <td>${dateStr}</td> 
                <td>${t.description || ''}</td>
                <td>${categoryBadge}</td>
                <td>${accountDisplay}</td>
                <td><span class="${typeClass}">${typeLabel}</span></td>
                <td class="text-end ${typeClass} fw-bold">${sign}${Number(t.amount).toLocaleString('vi-VN')} đ</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-warning me-1" 
                        data-bs-toggle="modal" data-bs-target="#transactionModal" 
                        onclick="prepareEditMode(${t.id})">Sửa</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction(${t.id})">Xóa</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}


// --- XỬ LÝ FORM (THÊM/SỬA) (CẬP NHẬT) ---

window.prepareAddMode = function() {
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionId').value = ''; 
    document.getElementById('modalTitle').textContent = "Thêm Giao Dịch";
    
    // Lấy ngày giờ hiện tại định dạng YYYY-MM-DDTHH:MM
    const now = new Date();
    // Chỉnh múi giờ để đảm bảo hiển thị đúng giờ địa phương trong input datetime-local
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); 
    document.getElementById('transaction_date').value = now.toISOString().slice(0, 16);
    
    document.getElementById('type').value = 'EXPENSE'; // Reset loại
    toggleTransferUI(); // Reset về Chi tiêu (ẩn trường đích)
}

window.prepareEditMode = function(id) {
    const transaction = currentTransactionsList.find(t => t.id === id);
    if (!transaction) return;

    document.getElementById('transactionId').value = transaction.id;
    document.getElementById('amount').value = transaction.amount;
    document.getElementById('description').value = transaction.description;
    
    // 1. Set loại trước để kích hoạt toggleTransferUI
    document.getElementById('type').value = transaction.type;
    toggleTransferUI(); // Gọi hàm để ẩn hiện ô nhập liệu

    // 2. Xử lý datetime-local: Cần dạng YYYY-MM-DDTHH:MM
    const dateObj = new Date(transaction.transaction_date);
    // Chỉnh lại múi giờ local để hiển thị đúng trong input
    dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
    const dateStr = dateObj.toISOString().slice(0, 16);
    
    document.getElementById('transaction_date').value = dateStr;

    document.getElementById('modalTitle').textContent = "Cập nhật Giao dịch";

    // 3. Xử lý Dropdown (Tài khoản & Danh mục)
    // Dùng setTimeout để chờ DOM cập nhật xong danh sách option
    setTimeout(() => {
        document.getElementById('account_id').value = transaction.source_account_id;
        
        if (transaction.type === 'TRANSFER') {
            const destAcc = document.getElementById('destination_account_id');
            if (destAcc) destAcc.value = transaction.destination_account_id;
        } else {
            document.getElementById('category_id').value = transaction.category_id;
        }
    }, 100);
}

// CẬP NHẬT: Hàm handleSaveTransaction
async function handleSaveTransaction(e) {
    e.preventDefault();
    const id = document.getElementById('transactionId').value;
    const type = document.getElementById('type').value;
    
    // Lấy dữ liệu cơ bản
    const data = {
        amount: document.getElementById('amount').value,
        type: type,
        source_account_id: document.getElementById('account_id').value,
        description: document.getElementById('description').value,
        transaction_date: document.getElementById('transaction_date').value
    };

    // Lấy dữ liệu tùy theo loại và kiểm tra lỗi
    if (type === 'TRANSFER') {
        data.destination_account_id = document.getElementById('destination_account_id').value;
        data.category_id = null; // Chuyển tiền ko cần danh mục
        
        if (data.source_account_id === data.destination_account_id) {
            alert("Tài khoản nguồn và đích không được giống nhau!");
            return;
        }
    } else {
        data.category_id = document.getElementById('category_id').value;
        data.destination_account_id = null;
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/transactions/${id}` : '/transactions/';
        
        await api.request(url, {
            method: method,
            body: JSON.stringify(data)
        });

        alert(id ? 'Cập nhật thành công!' : 'Thêm thành công!');
        // Ẩn modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('transactionModal'));
        modal.hide();
        loadTransactions();
    } catch (e) { alert('Lỗi: ' + e.message); }
}


window.deleteTransaction = async (id) => {
    if(!confirm("Bạn có chắc muốn xóa? Số dư tài khoản sẽ được hoàn lại.")) return;
    try {
        await api.request(`/transactions/${id}`, { method: 'DELETE' });
        loadTransactions();
    } catch (e) { alert("Lỗi khi xóa: " + e.message); }
};

// Hàm Reset bộ lọc (Được gọi từ transactions.html)
window.resetFilters = function() {
    document.getElementById('filterForm').reset();
    loadTransactions(); // Tải lại tất cả
}

// HÀM MỚI: XUẤT EXCEL (Giữ nguyên)
window.exportExcel = async function() {
    const btn = document.querySelector('.btn-success'); // Nút Excel
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
        
        // Gọi hàm download mới viết trong api.js (giả định đã được tạo)
        await api.download('/reports/export');
        
    } catch (e) {
        console.error("Lỗi xuất Excel:", e);
        alert("Xuất Excel thất bại. Vui lòng kiểm tra console log.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
    
}