let calendar;
let allCategories = [];
let currentTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadDropdowns();
    initCalendar();
    
    // Xử lý form submit (Thêm/Sửa)
    document.getElementById('transactionForm').addEventListener('submit', handleSaveTransaction);
    
    // Xử lý khi đổi loại giao dịch để lọc danh mục
    document.getElementById('type').addEventListener('change', (e) => {
        filterCategoriesByType(e.target.value);
    });
});

function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth', // Mặc định xem theo tháng
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay' // Các nút chuyển view
        },
        locale: 'vi', // Tiếng Việt
        buttonText: {
            today: 'Hôm nay',
            month: 'Tháng',
            week: 'Tuần',
            day: 'Ngày'
        },
        editable: true, // Cho phép kéo thả (nếu muốn làm nâng cao sau này)
        selectable: true, // Cho phép chọn ngày để thêm
        
        // --- 1. Tải sự kiện (Giao dịch) ---
        events: async function(info, successCallback, failureCallback) {
            try {
                // Gọi API lấy tất cả giao dịch (Backend chưa có filter date range, tạm lấy hết)
                // Nâng cao: Nên gửi start/end date lên API để lọc
                const accounts = await api.request('/accounts/');
                let allEvents = [];
                
                for (const acc of accounts) {
                    const trans = await api.request(`/transactions/?account_id=${acc.id}`);
                    
                    // Biến đổi transaction thành Event của Calendar
                    const events = trans.map(t => ({
                        id: t.id,
                        title: `${formatCurrencyShort(t.amount)} - ${t.description || 'Không tên'}`,
                        start: t.transaction_date,
                        backgroundColor: t.type === 'EXPENSE' ? '#e74c3c' : '#27ae60', // Đỏ/Xanh
                        borderColor: t.type === 'EXPENSE' ? '#c0392b' : '#2ecc71',
                        extendedProps: t // Lưu toàn bộ object gốc để dùng khi sửa
                    }));
                    allEvents = [...allEvents, ...events];
                }
                successCallback(allEvents);
                currentTransactions = allEvents;
            } catch (e) {
                failureCallback(e);
            }
        },

        // --- 2. Xử lý khi click vào ngày trống (Thêm mới) ---
        dateClick: function(info) {
            prepareAddMode(info.dateStr);
            const modal = new bootstrap.Modal(document.getElementById('transactionModal'));
            modal.show();
        },

        // --- 3. Xử lý khi click vào sự kiện (Sửa/Xóa) ---
        eventClick: function(info) {
            const task = info.event.extendedProps;
            prepareEditMode(task);
            const modal = new bootstrap.Modal(document.getElementById('transactionModal'));
            modal.show();
        }
    });
    
    calendar.render();
}

// --- CÁC HÀM HỖ TRỢ (Tái sử dụng từ bài trước) ---

async function loadDropdowns() {
    try {
        const [cats, accs] = await Promise.all([
            api.request('/categories/'),
            api.request('/accounts/')
        ]);
        allCategories = cats;

        const accSelect = document.getElementById('account_id');
        accSelect.innerHTML = '';
        accs.forEach(a => {
            accSelect.innerHTML += `<option value="${a.id}">${a.name}</option>`;
        });
        
        filterCategoriesByType('EXPENSE');
    } catch (e) { console.error(e); }
}

function filterCategoriesByType(type) {
    const catSelect = document.getElementById('category_id');
    catSelect.innerHTML = '';
    const filtered = allCategories.filter(c => c.type === type);
    if (filtered.length === 0) catSelect.innerHTML = '<option value="">Chưa có danh mục</option>';
    else filtered.forEach(c => catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`);
}

function prepareAddMode(dateStr) {
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionId').value = '';
    document.getElementById('modalTitle').textContent = "Thêm Giao Dịch Mới";
    document.getElementById('btnDelete').style.display = 'none'; // Ẩn nút xóa
    document.getElementById('transaction_date').value = dateStr; // Điền ngày vừa click
    filterCategoriesByType('EXPENSE');
}

function prepareEditMode(transaction) {
    document.getElementById('transactionId').value = transaction.id;
    document.getElementById('amount').value = transaction.amount;
    document.getElementById('type').value = transaction.type;
    document.getElementById('description').value = transaction.description;
    
    // Format ngày YYYY-MM-DD
    const dateStr = transaction.transaction_date.split('T')[0];
    document.getElementById('transaction_date').value = dateStr;

    // Load lại danh mục đúng loại
    filterCategoriesByType(transaction.type);
    
    // Set value sau khi dropdown update
    setTimeout(() => {
        document.getElementById('account_id').value = transaction.source_account_id;
        document.getElementById('category_id').value = transaction.category_id;
    }, 50);

    document.getElementById('modalTitle').textContent = "Chi tiết Giao dịch";
    document.getElementById('btnDelete').style.display = 'block'; // Hiện nút xóa
}

async function handleSaveTransaction(e) {
    e.preventDefault();
    const id = document.getElementById('transactionId').value;
    const data = {
        amount: document.getElementById('amount').value,
        type: document.getElementById('type').value,
        category_id: document.getElementById('category_id').value,
        source_account_id: document.getElementById('account_id').value,
        description: document.getElementById('description').value,
        transaction_date: document.getElementById('transaction_date').value
    };

    try {
        if (id) {
            await api.request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
            await api.request('/transactions/', { method: 'POST', body: JSON.stringify(data) });
        }
        
        // Reload lịch
        calendar.refetchEvents();
        
        // Đóng modal
        const modalEl = document.getElementById('transactionModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        
    } catch (e) { alert('Lỗi: ' + e.message); }
}

async function handleDelete() {
    const id = document.getElementById('transactionId').value;
    if(!id) return;
    
    if(!confirm("Bạn chắc chắn muốn xóa?")) return;
    
    try {
        await api.request(`/transactions/${id}`, { method: 'DELETE' });
        calendar.refetchEvents();
        
        const modalEl = document.getElementById('transactionModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
    } catch (e) { alert("Lỗi xóa: " + e.message); }
}

// Format tiền gọn (vd: 50k)
function formatCurrencyShort(amount) {
    return new Intl.NumberFormat('vi-VN', { 
        style: 'currency', 
        currency: 'VND', 
        maximumSignificantDigits: 3 
    }).format(amount);
}