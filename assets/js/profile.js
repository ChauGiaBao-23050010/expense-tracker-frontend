document.addEventListener('DOMContentLoaded', async () => {
    // Tải thông tin profile khi trang load
    await loadProfile();
    
    // Đính kèm các event listeners
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
    document.getElementById('passwordForm').addEventListener('submit', changePassword);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('accessToken');
        window.location.href = './login.html';
    });
});

/**
 * Tải thông tin người dùng hiện tại và điền vào form & header
 */
async function loadProfile() {
    try {
        // Gọi API lấy thông tin người dùng
        const user = await api.request('/users/me');
        
        // Cập nhật tên trên header/sidebar
        document.getElementById('user-name-display').textContent = user.full_name || user.username;
        
        // Cập nhật Avatar dựa trên tên (API miễn phí)
        const avatarUrl = `https://ui-avatars.com/api/?name=${user.full_name || user.username}&background=random&color=fff`;
        document.getElementById('user-avatar').src = avatarUrl;

        // Điền dữ liệu vào form
        document.getElementById('username').value = user.username;
        document.getElementById('email').value = user.email || '';
        document.getElementById('fullName').value = user.full_name || '';
    } catch (e) {
        showToast('Lỗi', 'Không thể tải thông tin hồ sơ. Vui lòng thử lại.', 'text-danger');
    }
}

/**
 * Xử lý cập nhật thông tin email và họ tên
 */
async function updateProfile(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    
    // Hiển thị trạng thái loading
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

    const data = {
        email: document.getElementById('email').value,
        full_name: document.getElementById('fullName').value
    };

    try {
        await api.request('/users/me', { method: 'PUT', body: JSON.stringify(data) });
        showToast('Thành công', 'Cập nhật hồ sơ thành công!', 'text-success');
        await loadProfile(); // Reload để cập nhật avatar và tên trên header
    } catch (err) {
        showToast('Thất bại', err.message, 'text-danger');
    } finally {
        // Kết thúc trạng thái loading
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * Xử lý đổi mật khẩu
 */
async function changePassword(e) {
    e.preventDefault();
    
    // Lưu ý: Cần đảm bảo ID trong HTML là 'newPassword' và 'confirmNewPassword'
    const currentPass = document.getElementById('currentPassword').value; 
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmNewPassword').value;

    if (newPass !== confirmPass) {
        showToast('Lỗi', 'Mật khẩu xác nhận không khớp!', 'text-danger');
        return;
    }

    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    
    // Hiển thị trạng thái loading
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

    const data = {
        current_password: currentPass,
        new_password: newPass
    };

    try {
        await api.request('/users/me/password', { method: 'PATCH', body: JSON.stringify(data) });
        showToast('Thành công', 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.', 'text-success');
        document.getElementById('passwordForm').reset();
        
        // Logout sau 2 giây để user đăng nhập lại
        setTimeout(() => {
            localStorage.removeItem('accessToken');
            window.location.href = './login.html';
        }, 2000);
    } catch (err) {
        showToast('Thất bại', err.message, 'text-danger');
    } finally {
        // Kết thúc trạng thái loading
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * Hàm hiển thị thông báo chuyên nghiệp (Bootstrap Toast)
 * @param {string} title - Tiêu đề thông báo
 * @param {string} message - Nội dung thông báo
 * @param {string} textColor - Class màu chữ Bootstrap (vd: text-success, text-danger)
 */
function showToast(title, message, textColor = 'text-dark') {
    const toastEl = document.getElementById('liveToast');
    
    document.getElementById('toastTitle').textContent = title;
    // Cập nhật màu tiêu đề
    document.getElementById('toastTitle').className = `me-auto fw-bold ${textColor}`; 
    document.getElementById('toastMessage').textContent = message;
    
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}