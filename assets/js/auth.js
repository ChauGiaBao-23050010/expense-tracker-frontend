// Chờ cho toàn bộ trang web được tải xong rồi mới chạy code
document.addEventListener('DOMContentLoaded', () => {
    
    // Tìm form đăng nhập trong file HTML
    const loginForm = document.getElementById('loginForm');

    // Nếu tìm thấy form, gắn sự kiện "submit" cho nó
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            // Ngăn trình duyệt tải lại trang (hành vi mặc định của form)
            event.preventDefault(); 

            // Tìm các phần tử trong form
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const errorMessage = document.getElementById('error-message');
            const submitButton = loginForm.querySelector('button');

            // Xóa thông báo lỗi cũ
            errorMessage.textContent = '';

            // Lấy giá trị người dùng nhập vào
            const username = usernameInput.value;
            const password = passwordInput.value;
            
            // Thay đổi giao diện nút để báo cho người dùng biết đang xử lý
            submitButton.disabled = true;
            submitButton.textContent = 'Đang đăng nhập...';

            try {
                // Gọi hàm login từ api.js
                const data = await api.login(username, password);

                console.log('Đăng nhập thành công:', data);

                // --- BƯỚC QUAN TRỌNG ---
                // Lưu token vào localStorage để dùng cho các trang khác
                localStorage.setItem('accessToken', data.access_token);
                
                // Chuyển hướng người dùng đến trang dashboard chính
                window.location.href = './index.html';

            } catch (error) {
                // Nếu có lỗi, hiển thị cho người dùng
                errorMessage.textContent = error.message;
            } finally {
                // Dù thành công hay thất bại, bật lại nút và trả lại text cũ
                submitButton.disabled = false;
                submitButton.textContent = 'Đăng nhập';
            }
        });
    }

    // --- BẮT ĐẦU LOGIC XỬ LÝ FORM ĐĂNG KÝ ---
    
    // Tìm form đăng ký trong file HTML
    const registerForm = document.getElementById('registerForm');

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const fullName = document.getElementById('fullName').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            const errorMessage = document.getElementById('error-message');
            const successMessage = document.getElementById('success-message');
            const submitButton = registerForm.querySelector('button');

            // Xóa các thông báo cũ
            errorMessage.textContent = '';
            successMessage.textContent = '';

            // --- Kiểm tra dữ liệu đầu vào đơn giản ---
            if (password !== confirmPassword) {
                errorMessage.textContent = 'Mật khẩu xác nhận không khớp!';
                return;
            }
            if (password.length < 6) {
                errorMessage.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.';
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = 'Đang xử lý...';

            try {
                const userData = {
                    username: username,
                    password: password,
                    email: email,
                    full_name: fullName
                };

                const result = await api.register(userData);
                console.log('Đăng ký thành công:', result);

                // Hiển thị thông báo thành công và chuyển hướng sau 2 giây
                successMessage.textContent = 'Đăng ký thành công! Đang chuyển đến trang đăng nhập...';
                
                setTimeout(() => {
                    window.location.href = './login.html';
                }, 2000); // Chờ 2 giây

            } catch (error) {
                errorMessage.textContent = error.message;
                submitButton.disabled = false;
                submitButton.textContent = 'Đăng ký';
            }
        });
    }
});