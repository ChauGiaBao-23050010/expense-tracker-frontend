// =================================================================
// recurring.js - Logic JavaScript cho trang Quản lý Giao dịch Định kỳ
// =================================================================

// --- BIẾN TOÀN CỤC ---
let allCategories = []; // Danh sách tất cả danh mục gốc từ API
let allAccounts = [];   // Danh sách tất cả tài khoản gốc từ API
let accountsMap = {};   // Map ID -> Name của Tài khoản (QUAN TRỌNG cho renderTable)
let categoriesMap = {}; // Map ID -> Name của Danh mục (QUAN TRỌNG cho renderTable)
let currentRecurringList = []; // Danh sách giao dịch định kỳ đang hiển thị

// --- CẤU HÌNH ELEMENT/API ---
const MODAL_ID = 'recurringTransactionModal';
const FORM_ID = 'recurringForm'; 
const TABLE_BODY_ID = 'recurring-transaction-table-body'; // ID này khớp với HTML
const API_BASE = '/recurring'; 

// --- ĐIỂM KHỞI TẠO CHÍNH (Sử dụng DOMContentLoaded để đảm bảo mọi thứ đã sẵn sàng) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Tải dữ liệu cho dropdowns, tạo Map
    await loadDropdownData();
    
    // 2. Tải danh sách giao dịch định kỳ lần đầu
    await loadRecurringList();

    // 3. Lắng nghe sự kiện
    setupEventListeners();
    
    // Khởi tạo UI Modal mặc định (EXPENSE)
    window.toggleTransferUI();
});

/**
 * Gắn các sự kiện cho form, nút, và dropdown.
 */
function setupEventListeners() {
    document.getElementById(FORM_ID).addEventListener('submit', handleSaveRecurring);

    document.getElementById('filterForm').addEventListener('submit', (e) => {
        e.preventDefault();
        loadRecurringList();
    });
    
    // Thêm listener cho tất cả các bộ lọc để tự động load khi thay đổi
    document.getElementById('filter_search').addEventListener('input', debounce(loadRecurringList, 500));
    document.getElementById('filter_type').addEventListener('change', loadRecurringList);
    document.getElementById('filter_frequency').addEventListener('change', loadRecurringList);
    document.getElementById('filter_status').addEventListener('change', loadRecurringList);
    
    // Sự kiện quan trọng: Khi đổi loại giao dịch trong form, cập nhật UI và lọc lại danh mục
    document.getElementById('type').addEventListener('change', () => {
        window.toggleTransferUI(); 
    });
}

/**
 * Hàm Debounce để giới hạn tần suất gọi hàm (dùng cho filter_search)
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}


// --- TẢI DỮ LIỆU VÀ CẬP NHẬT DROPDOWNS ---

/**
 * Tải tài khoản và danh mục từ API, điền vào các dropdowns và tạo Maps.
 */
async function loadDropdownData() {
    try {
        // Tải đồng thời
        const [cats, accs] = await Promise.all([
            api.request('/categories/'),
            api.request('/accounts/')
        ]);
        
        allCategories = cats;
        allAccounts = accs;

        // 1. Tạo Maps để tra cứu nhanh trong renderTable
        allCategories.forEach(c => { categoriesMap[c.id] = c.name; });
        allAccounts.forEach(a => { accountsMap[a.id] = a.name; });

        // 2. Điền dữ liệu vào dropdown Account (Source/Destination)
        const srcSelectModal = document.getElementById('source_account_id');
        const destSelectModal = document.getElementById('destination_account_id');
        
        // Clear options cũ (nếu có)
        srcSelectModal.innerHTML = '';
        destSelectModal.innerHTML = '';
        
        if (allAccounts.length > 0) {
            allAccounts.forEach(a => {
                const option = `<option value="${a.id}">${a.name}</option>`;
                srcSelectModal.innerHTML += option;
                destSelectModal.innerHTML += option;
            });
            // Đảm bảo có ít nhất 1 tài khoản được chọn mặc định
            srcSelectModal.value = allAccounts[0].id;
        } else {
            srcSelectModal.innerHTML = '<option value="" disabled>Chưa có tài khoản</option>';
            destSelectModal.innerHTML = '<option value="" disabled>Chưa có tài khoản</option>';
        }

        // 3. Đặt mặc định loại giao dịch
        document.getElementById('type').value = 'EXPENSE'; 
    } catch (e) { 
        console.error("Lỗi tải dropdowns:", e); 
        // Thay vì alert, hiển thị thông báo nhẹ nhàng hơn trong môi trường UI thực tế
    }
}

/**
 * Hàm lọc danh mục theo loại (dựa trên giá trị của #type) và điền vào dropdown.
 * @param {string|number|null} selectedValue ID của danh mục cần chọn sẵn.
 */
function filterCategoriesByType(selectedValue = null) {
    // Lấy giá trị 'type' hiện tại từ dropdown trong modal
    const type = document.getElementById('type').value; 
    const catSelect = document.getElementById('category_id');

    if (!catSelect || type === 'TRANSFER') return;

    catSelect.innerHTML = ''; 
    
    const filtered = allCategories.filter(c => c.type === type);
    
    // Luôn thêm lựa chọn "Không phân loại" (giá trị rỗng hoặc null)
    catSelect.innerHTML = '<option value="">Không phân loại (Tùy chọn)</option>';
    
    if (filtered.length > 0) {
        filtered.forEach(c => {
            catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`; 
        });
    }

    // Nếu có giá trị cần chọn sẵn
    if (selectedValue) {
        catSelect.value = selectedValue;
    }
}

/**
 * Hàm điều khiển hiển thị trường Danh mục và Tài khoản đích dựa trên loại giao dịch.
 */
window.toggleTransferUI = function(category_id_to_select = null) {
    const type = document.getElementById('type').value;
    const groupCategory = document.getElementById('group_category');
    const groupDest = document.getElementById('group_destination');
    const categorySelect = document.getElementById('category_id');
    const destSelect = document.getElementById('destination_account_id');

    if (type === 'TRANSFER') {
        // Ẩn Danh mục, Hiện Tài khoản đích
        if (groupCategory) groupCategory.style.display = 'none';
        if (groupDest) groupDest.style.display = 'block';
        
        // Thiết lập thuộc tính required
        if (categorySelect) categorySelect.removeAttribute('required');
        if (destSelect) destSelect.setAttribute('required', 'true');
        
    } else {
        // Hiện Danh mục, Ẩn Tài khoản đích
        if (groupCategory) groupCategory.style.display = 'block';
        if (groupDest) groupDest.style.display = 'none';
        
        // Thiết lập thuộc tính required
        if (categorySelect) categorySelect.removeAttribute('required'); // Không bắt buộc vì có thể "Không phân loại"
        if (destSelect) destSelect.removeAttribute('required');

        // Lọc lại danh mục theo loại mới
        filterCategoriesByType(category_id_to_select);
    }
}

// --- TẢI DANH SÁCH & HIỂN THỊ BẢNG ---

/**
 * Tải danh sách giao dịch định kỳ (đã bao gồm logic lọc).
 */
async function loadRecurringList() {
    const tbody = document.getElementById(TABLE_BODY_ID);
    tbody.innerHTML = '<tr><td colspan="8" class="text-center"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    
    try {
        // Lấy giá trị từ bộ lọc
        const search = document.getElementById('filter_search').value.trim();
        const type = document.getElementById('filter_type').value;
        const frequency = document.getElementById('filter_frequency').value;
        const status = document.getElementById('filter_status').value;

        // Tạo URL params
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (type) params.append('type', type); 
        if (frequency) params.append('frequency', frequency);
        // status là chuỗi 'true'/'false'
        if (status) params.append('is_active', status); 

        // GỌI API
        const recurringTrans = await api.request(`${API_BASE}/?${params.toString()}`);
        
        // Sắp xếp theo ngày chạy tiếp theo (Ngày chạy gần nhất lên đầu)
        recurringTrans.sort((a, b) => new Date(a.next_run_date) - new Date(b.next_run_date));
        currentRecurringList = recurringTrans; 
        
        renderTable(recurringTrans);
    } catch (e) { 
        console.error("Lỗi tải giao dịch định kỳ:", e);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Lỗi khi tải dữ liệu</td></tr>';
    }
}

/**
 * Hiển thị dữ liệu giao dịch định kỳ ra bảng.
 */
function renderTable(transactions) {
    const tbody = document.getElementById(TABLE_BODY_ID);
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Không tìm thấy giao dịch định kỳ nào.</td></tr>';
        return;
    }
    
    const frequencyMap = {
        'DAILY': 'Hàng ngày',
        'WEEKLY': 'Hàng tuần',
        'MONTHLY': 'Hàng tháng',
        'YEARLY': 'Hàng năm',
    };

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('vi-VN');

    transactions.forEach(t => {
        let typeClass = '';
        let sign = '';
        let accountDisplay = '';
        
        // Ưu tiên hiển thị mô tả, nếu không có, lấy tên danh mục
        let descriptionDisplay = t.description || (t.category_id ? categoriesMap[t.category_id] : 'Không mô tả');
        
        if (t.type === 'EXPENSE') {
            typeClass = 'text-expense';
            sign = '-';
            accountDisplay = accountsMap[t.source_account_id] || 'N/A';
        } else if (t.type === 'INCOME') {
            typeClass = 'text-income';
            sign = '+';
            accountDisplay = accountsMap[t.source_account_id] || 'N/A';
        } else if (t.type === 'TRANSFER' && t.destination_account_id) {
            typeClass = 'text-transfer';
            sign = '';
            accountDisplay = `${accountsMap[t.source_account_id] || 'N/A'} <i class="fas fa-arrow-right mx-1 text-muted"></i> ${accountsMap[t.destination_account_id] || 'N/A'}`;
            descriptionDisplay = t.description || 'Chuyển tiền nội bộ';
        } else {
             // Fallback
             typeClass = 'text-muted';
             sign = '';
             accountDisplay = accountsMap[t.source_account_id] || 'N/A';
        }

        const statusClass = t.is_active ? 'text-active' : 'text-inactive';
        const statusLabel = t.is_active ? 'Đang bật' : 'Đã tắt';
        
        const row = `
            <tr>
                <td>${descriptionDisplay}</td>
                <td>${accountDisplay}</td>
                <td class="text-end ${typeClass} fw-bold">${sign}${Number(t.amount).toLocaleString('vi-VN')} đ</td>
                <td>${frequencyMap[t.frequency] || 'N/A'}</td>
                <td>${formatDate(t.start_date)}</td>
                <td>${formatDate(t.next_run_date)}</td>
                <td class="text-center ${statusClass}">${statusLabel}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-warning me-1" 
                        data-bs-toggle="modal" data-bs-target="#${MODAL_ID}" 
                        onclick="prepareEditMode(${t.id})"><i class="fas fa-edit"></i> Sửa</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteRecurring(${t.id})"><i class="fas fa-trash"></i> Xóa</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// --- XỬ LÝ FORM MODAL (THÊM/SỬA/XÓA) ---

/**
 * Chuẩn bị modal cho chế độ Thêm mới.
 */
window.prepareAddMode = function() {
    const form = document.getElementById(FORM_ID);
    form.reset(); 
    
    document.getElementById('recurringId').value = ''; 
    document.getElementById('modalTitle').textContent = "Thêm Giao Dịch Định Kỳ";

    // Set giá trị mặc định cho các trường
    document.getElementById('start_date').value = new Date().toISOString().split('T')[0];
    document.getElementById('is_active').checked = true;
    document.getElementById('frequency').value = 'MONTHLY';

    // Set mặc định là 'EXPENSE' và gọi toggle để cập nhật UI
    document.getElementById('type').value = 'EXPENSE';
    // Đảm bảo chọn lại tài khoản nguồn mặc định (nếu có)
    if (allAccounts.length > 0) {
        document.getElementById('source_account_id').value = allAccounts[0].id;
    }
    window.toggleTransferUI(); 
}

/**
 * Chuẩn bị modal cho chế độ Chỉnh sửa.
 */
window.prepareEditMode = function(id) {
    const item = currentRecurringList.find(r => r.id === id);
    if (!item) return;

    const form = document.getElementById(FORM_ID);
    form.reset(); 

    document.getElementById('recurringId').value = item.id;
    document.getElementById('amount').value = item.amount;
    document.getElementById('description').value = item.description || '';
    document.getElementById('frequency').value = item.frequency;
    
    // Xử lý date (chỉ lấy YYYY-MM-DD)
    const formatDateInput = (dateString) => new Date(dateString).toISOString().split('T')[0];
    document.getElementById('start_date').value = formatDateInput(item.start_date);
    
    document.getElementById('is_active').checked = item.is_active;

    document.getElementById('modalTitle').textContent = `Cập nhật Định kỳ ID: ${item.id}`;
    
    // 1. Set loại trước
    document.getElementById('type').value = item.type;
    
    // 2. Gọi toggle để ẩn/hiện trường Category/Destination và lọc Danh mục
    // Truyền category_id để toggleUI gọi filterCategoriesByType và chọn sẵn
    window.toggleTransferUI(item.category_id); 

    // 3. Set dropdowns Account
    setTimeout(() => {
        document.getElementById('source_account_id').value = item.source_account_id;
        if (item.type === 'TRANSFER' && item.destination_account_id) {
            document.getElementById('destination_account_id').value = item.destination_account_id;
        }
    }, 50); // Dùng setTimeout để đảm bảo DOM đã cập nhật sau toggleTransferUI
}

// Hàm lưu (Thêm/Sửa)
async function handleSaveRecurring(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xử lý...';

    const id = document.getElementById('recurringId').value;
    const type = document.getElementById('type').value;
    
    const data = {
        amount: parseFloat(document.getElementById('amount').value),
        type: type,
        source_account_id: parseInt(document.getElementById('source_account_id').value),
        description: document.getElementById('description').value.trim() || null,
        frequency: document.getElementById('frequency').value,
        start_date: document.getElementById('start_date').value,
        is_active: document.getElementById('is_active').checked,
    };
    
    // 1. Xử lý logic TRANSFER
    if (type === 'TRANSFER') {
        data.destination_account_id = parseInt(document.getElementById('destination_account_id').value);
        data.category_id = null;
        
        if (data.source_account_id === data.destination_account_id) {
            alert("Lỗi: Tài khoản nguồn và đích không được giống nhau!");
            submitBtn.disabled = false;
            submitBtn.textContent = 'Lưu lại';
            return;
        }
    } 
    // 2. Xử lý logic INCOME/EXPENSE
    else {
        const catId = document.getElementById('category_id').value;
        // Chuyển chuỗi rỗng thành null (cho "Không phân loại")
        data.category_id = catId ? parseInt(catId) : null; 
        data.destination_account_id = null;
    }
    
    // 3. Kiểm tra dữ liệu hợp lệ cơ bản
    if (isNaN(data.amount) || data.amount <= 0) {
        alert("Lỗi: Số tiền không hợp lệ.");
        submitBtn.disabled = false;
        submitBtn.textContent = 'Lưu lại';
        return;
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/${id}` : API_BASE;
        
        await api.request(url, {
            method: method,
            body: JSON.stringify(data)
        });

        alert(id ? 'Cập nhật thành công!' : 'Thêm thành công!');
        
        // Đóng modal
        const modalElement = document.getElementById(MODAL_ID);
        const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
        modalInstance.hide();
        
        // Tải lại danh sách
        await loadRecurringList();
    } catch (e) {
        const errorMsg = (e.detail && e.detail.error) || e.message || "Lỗi không xác định khi lưu.";
        alert('Lỗi: ' + errorMsg);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Lưu lại';
    }
}

/**
 * Xóa giao dịch định kỳ
 */
window.deleteRecurring = async (id) => {
    if(!confirm("Bạn có chắc muốn xóa giao dịch định kỳ này không?")) return;
    try {
        await api.request(`${API_BASE}/${id}`, { method: 'DELETE' });
        loadRecurringList();
        alert("Xóa thành công.");
    } catch (e) { 
        const errorMsg = (e.detail && e.detail.error) || e.message || "Lỗi không xác định khi xóa.";
        alert("Lỗi khi xóa: " + errorMsg); 
    }
};

/**
 * Hàm Reset bộ lọc
 */
window.resetFilters = function() {
    document.getElementById('filterForm').reset();
    // Đặt lại trạng thái mặc định cho các select
    document.getElementById('filter_search').value = '';
    document.getElementById('filter_type').value = '';
    document.getElementById('filter_frequency').value = '';
    document.getElementById('filter_status').value = '';
    
    loadRecurringList(); 
}